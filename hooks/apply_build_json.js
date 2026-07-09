const fs = require('fs');
const path = require('path');

module.exports = function(context) {
// Get the root directory of the Cordova project
const projectRoot = context.opts.projectRoot;
// Get the path to your build.json inside the plugin folder
const sourceFile = path.join(context.opts.plugin.dir, 'hooks', 'build.json');

// Set the destination path to the project root
const targetFile = path.join(projectRoot, 'build.json');

// Copy the file so MABS can read it
if (fs.existsSync(sourceFile)) {
    fs.copyFileSync(sourceFile, targetFile);
    console.log('Successfully injected build.json into the project root!');
} else {
    console.error('build.json not found in the plugin hooks directory.');
}
};
