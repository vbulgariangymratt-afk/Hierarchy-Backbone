use tauri::Manager;
use tauri::Emitter;
use tauri_plugin_liquid_glass::{LiquidGlassConfig, LiquidGlassExt, GlassMaterialVariant};
use tauri_plugin_deep_link::DeepLinkExt;

#[tauri::command]
fn enable_liquid_glass(app: tauri::AppHandle, theme: Option<String>) {
  if let Some(window) = app.get_webview_window("main") {
    // Explicitly set the window theme if provided to prevent OS override
    if let Some(t) = theme {
      let tauri_theme = if t == "dark" { Some(tauri::Theme::Dark) } else { Some(tauri::Theme::Light) };
      let _ = window.set_theme(tauri_theme);
    }

    let _ = app.liquid_glass().set_effect(
      &window,
      LiquidGlassConfig {
        variant: GlassMaterialVariant::Sidebar,
        corner_radius: 16.0,
        ..Default::default()
      },
    );
  }
}

#[tauri::command]
fn disable_liquid_glass(app: tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.set_theme(None); // Reset to system default theme
    let _ = app.liquid_glass().set_effect(
      &window,
      LiquidGlassConfig {
        enabled: false,
        ..Default::default()
      },
    );
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_liquid_glass::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_window_state::Builder::default().build())
    .invoke_handler(tauri::generate_handler![enable_liquid_glass, disable_liquid_glass])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      enable_liquid_glass(app.handle().clone(), None);

      // Capture deep link URL at startup (macOS sends it before JS is ready)
      let handle = app.handle().clone();
      app.deep_link().on_open_url(move |event| {
        let urls = event.urls();
        let handle = handle.clone();
        tauri::async_runtime::spawn(async move {
          std::thread::sleep(std::time::Duration::from_millis(3000));
          for url in urls {
            let url_str = url.to_string();
            println!("[DEEP LINK] Emitting after delay: {}", url_str);
            handle.emit("deep-link-received", url_str).ok();
          }
        });
      });

      #[cfg(target_os = "macos")]
      {
          let app_handle = app.handle().clone();
          std::thread::spawn(move || {
              let mut last_dark = {
                  let output = std::process::Command::new("defaults")
                      .args(["read", "-g", "AppleInterfaceStyle"])
                      .output();
                  matches!(output, Ok(o) if 
                      String::from_utf8_lossy(&o.stdout).trim() == "Dark")
              };
              loop {
                  std::thread::sleep(std::time::Duration::from_millis(500));
                  let output = std::process::Command::new("defaults")
                      .args(["read", "-g", "AppleInterfaceStyle"])
                      .output();
                  let is_dark = matches!(output, Ok(o) if 
                      String::from_utf8_lossy(&o.stdout).trim() == "Dark");
                  if is_dark != last_dark {
                      last_dark = is_dark;
                      let _ = app_handle.emit("system-appearance-changed", is_dark);
                  }
              }
          });
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
