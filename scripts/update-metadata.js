import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const targetRepo = 'vbulgariangymratt-afk/Backbone-s-minimal-webpage';
const githubToken = process.env.PUBLIC_REPO_TOKEN;

if (!githubToken) {
  console.error('Error: PUBLIC_REPO_TOKEN environment variable is not set.');
  process.exit(1);
}

// 1. Read version from tauri.conf.json
const tauriConfPath = path.resolve('src-tauri/tauri.conf.json');
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
const version = tauriConf.version;

console.log(`Detected version: ${version}`);

// 2. Fetch existing updater.json from the public repo, or start fresh
let updaterJson = {
  version: version,
  notes: `Backbone Hierarchy update v${version}`,
  pub_date: new Date().toISOString(),
  platforms: {}
};

const updaterJsonUrl = `https://raw.githubusercontent.com/${targetRepo}/main/updater.json`;
try {
  const response = execSync(`curl -s ${updaterJsonUrl}`).toString().trim();
  if (response && !response.includes('404: Not Found') && response.startsWith('{')) {
    updaterJson = JSON.parse(response);
    updaterJson.version = version;
    updaterJson.pub_date = new Date().toISOString();
    updaterJson.notes = `Backbone Hierarchy update v${version}`;
    console.log('Successfully fetched existing updater.json');
  }
} catch (e) {
  console.log('No existing updater.json found on target repository, creating fresh.');
}

// Ensure platforms object exists
if (!updaterJson.platforms) {
  updaterJson.platforms = {};
}

// 3. Detect and read built assets based on OS
const platform = process.platform;
console.log(`Detected run platform: ${platform}`);

if (platform === 'darwin') {
  // macOS updater build targets
  const bundleDir = path.resolve('src-tauri/target/release/bundle/macos');
  
  // Find .tar.gz and .tar.gz.sig files
  const files = fs.readdirSync(bundleDir);
  const tarFile = files.find(f => f.endsWith('.tar.gz'));
  
  if (tarFile) {
    const sigFile = `${tarFile}.sig`;
    const sigPath = path.join(bundleDir, sigFile);
    
    if (fs.existsSync(sigPath)) {
      const signature = fs.readFileSync(sigPath, 'utf8').trim();
      const downloadUrl = `https://github.com/${targetRepo}/releases/download/latest/Backbone-macOS.tar.gz`;
      
      // Update both apple Silicon and Intel targets since they are bundled or separate
      updaterJson.platforms['darwin-aarch64'] = { signature, url: downloadUrl };
      updaterJson.platforms['darwin-x86_64'] = { signature, url: downloadUrl };
      
      console.log('Added macOS signatures and platform URLs.');
      
      // Copy asset to root folder for upload
      fs.copyFileSync(path.join(bundleDir, tarFile), path.resolve('Backbone-macOS.tar.gz'));
    } else {
      console.error(`Signature file not found at ${sigPath}`);
      process.exit(1);
    }
  } else {
    console.error('No macOS .tar.gz updater package found in bundle directory.');
    process.exit(1);
  }
} else if (platform === 'win32') {
  // Windows updater build targets
  const nsisDir = path.resolve('src-tauri/target/release/bundle/nsis');
  const files = fs.readdirSync(nsisDir);
  const exeFile = files.find(f => f.endsWith('.exe'));
  
  if (exeFile) {
    const sigFile = `${exeFile}.sig`;
    const sigPath = path.join(nsisDir, sigFile);
    
    if (fs.existsSync(sigPath)) {
      const signature = fs.readFileSync(sigPath, 'utf8').trim();
      const downloadUrl = `https://github.com/${targetRepo}/releases/download/latest/Backbone-Setup.exe`;
      
      updaterJson.platforms['windows-x86_64'] = { signature, url: downloadUrl };
      
      console.log('Added Windows signature and platform URL.');
      
      // Copy asset to root folder for upload
      fs.copyFileSync(path.join(nsisDir, exeFile), path.resolve('Backbone-Setup.exe'));
    } else {
      console.error(`Signature file not found at ${sigPath}`);
      process.exit(1);
    }
  } else {
    console.error('No Windows .exe updater package found in nsis directory.');
    process.exit(1);
  }
}

// 4. Save updater.json locally so it can be committed
fs.writeFileSync(path.resolve('updater.json'), JSON.stringify(updaterJson, null, 2));
console.log('Locally generated updated updater.json successfully:');
console.log(JSON.stringify(updaterJson, null, 2));

// 5. Commit and push updater.json directly to the public page repository
try {
  console.log('Cloning the public landing page repository to commit updater.json...');
  const tempCloneDir = path.resolve('temp-page-repo');
  if (fs.existsSync(tempCloneDir)) {
    fs.rmSync(tempCloneDir, { recursive: true, force: true });
  }
  
  // Clone public repository using token
  execSync(`git clone https://x-access-token:${githubToken}@github.com/${targetRepo}.git ${tempCloneDir}`);
  
  // Copy updated updater.json into cloned repository
  fs.copyFileSync(path.resolve('updater.json'), path.join(tempCloneDir, 'updater.json'));
  
  // Commit and push changes
  execSync(`git config --global user.name "Backbone Update Bot"`);
  execSync(`git config --global user.email "bot@backbone.com"`);
  execSync(`git add updater.json`, { cwd: tempCloneDir });
  execSync(`git commit -m "Update updater.json for version ${version}"`, { cwd: tempCloneDir });
  execSync(`git push origin main`, { cwd: tempCloneDir });
  
  console.log('Successfully pushed updater.json to public repository!');
  
  // Clean up
  fs.rmSync(tempCloneDir, { recursive: true, force: true });
} catch (error) {
  console.error('Failed to push updater.json to the landing page repo:', error.message);
  process.exit(1);
}
