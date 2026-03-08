use tauri::Manager;
use tauri_plugin_liquid_glass::{LiquidGlassConfig, LiquidGlassExt, GlassMaterialVariant};

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
    .plugin(tauri_plugin_liquid_glass::init())
    .invoke_handler(tauri::generate_handler![enable_liquid_glass, disable_liquid_glass])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Initial state based on current preference (handled by frontend on mount if needed,
      // but applying it here as well for immediate startup)
      enable_liquid_glass(app.handle().clone(), None);

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
