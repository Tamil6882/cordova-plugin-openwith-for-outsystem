const fs = require('fs');
const path = require('path');

module.exports = function(context) {
  try {
    // Get the root directory of the Cordova project
    const projectRoot = context.opts.projectRoot;
    
    // Get the path to build.json inside the plugin folder
    const sourceFile = path.join(context.opts.plugin.dir, 'hooks', 'build.json');
    
    // Set the destination path to the project root
    const targetFile = path.join(projectRoot, 'build.json');

    // Copy the file so MABS can read it
    if (fs.existsSync(sourceFile)) {
      try {
        fs.copyFileSync(sourceFile, targetFile);
        console.log('[cordova-plugin-openwith] Successfully injected build.json into project root');
      } catch (copyErr) {
        console.error('[cordova-plugin-openwith] Error copying build.json:', copyErr.message);
        // Don't throw - allow build to continue even if build.json copy fails
      }
    } else {
      console.warn('[cordova-plugin-openwith] build.json not found at: ' + sourceFile);
      // Don't throw - build.json is optional
    }
  } catch (err) {
    console.error('[cordova-plugin-openwith] Unexpected error in apply_build_json.js:', err.message);
    // Don't throw - allow build to continue
  }
};
