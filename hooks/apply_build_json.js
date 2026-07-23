module.exports = function(context) {
  const fs = require('fs');
  const path = require('path');
  
  const projectRoot = context.opts.projectRoot;
  const sourceFile = path.join(context.opts.plugin.dir, 'hooks', 'build.json');
  const targetFile = path.join(projectRoot, 'build.json');

  if (fs.existsSync(sourceFile)) {
    try {
      fs.copyFileSync(sourceFile, targetFile);
      console.log('[cordova-plugin-openwith] Successfully injected build.json');
    } catch (err) {
      console.error('[cordova-plugin-openwith] Error copying build.json:', err);
    }
  } else {
    console.warn('[cordova-plugin-openwith] build.json not found at: ' + sourceFile);
  }
};
