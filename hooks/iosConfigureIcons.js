const fs = require('fs');
const path = require('path');

const {
  PLUGIN_ID,
  iosFolder,
  log,
  redError,
} = require('./utils');

/**
 * Configures app icons for the ShareExtension target.
 * This ensures the share extension displays the app icon in the iOS share menu.
 * 
 * This hook copies icon asset configurations from the main app target to the
 * ShareExtension target in the Xcode build settings.
 */
module.exports = function(context) {
  log('Configuring icons for ShareExtension target');

  try {
    var xcode = require('xcode');
    var projectFolder = path.join(context.opts.projectRoot, 'platforms', 'ios');
    var projectName = fs.readdirSync(projectFolder).find(name => name.endsWith('.xcodeproj'));
    
    if (!projectName) {
      throw new Error('Could not find .xcodeproj file');
    }

    var pbxProjectPath = path.join(projectFolder, projectName, 'project.pbxproj');
    var pbxProject = xcode.project(pbxProjectPath);
    pbxProject.parseSync();

    // Get the main target name (usually matches the project name)
    var mainTargetName = projectName.replace('.xcodeproj', '');
    var shareExtTargetName = 'ShareExt';

    var mainTarget = pbxProject.pbxTargetByName(mainTargetName) || pbxProject.pbxTargetByName('"' + mainTargetName + '"');
    var shareExtTarget = pbxProject.pbxTargetByName(shareExtTargetName) || pbxProject.pbxTargetByName('"' + shareExtTargetName + '"');

    if (!mainTarget) {
      log('Warning: Main target not found. Icons may need to be configured manually.');
      return;
    }

    if (!shareExtTarget) {
      log('ShareExtension target not found. Skipping icon configuration.');
      return;
    }

    log('Copying icon configuration from main target to ShareExtension');

    // Get build settings for both targets
    var buildConfigSection = pbxProject.pbxXCBuildConfigurationSection();
    var configLists = pbxProject.pbxXCConfigurationList();

    // Get main target's configuration
    var mainConfigListUuid = mainTarget.pbxNativeTarget.buildConfigurationList;
    var mainConfigList = configLists[mainConfigListUuid];

    // Get ShareExt target's configuration
    var shareExtConfigListUuid = shareExtTarget.pbxNativeTarget.buildConfigurationList;
    var shareExtConfigList = configLists[shareExtConfigListUuid];

    if (!mainConfigList || !shareExtConfigList) {
      log('Warning: Could not locate build configuration lists.');
      return;
    }

    // Copy ASSETCATALOG_COMPILER_APPICON_NAME from main target to ShareExt target
    mainConfigList.buildConfigurations.forEach(function(mainConfRef) {
      var mainConf = buildConfigSection[mainConfRef.value];
      
      if (mainConf && mainConf.buildSettings) {
        // Find corresponding configuration in ShareExt (Debug/Release)
        shareExtConfigList.buildConfigurations.forEach(function(shareExtConfRef) {
          var shareExtConf = buildConfigSection[shareExtConfRef.value];
          
          if (shareExtConf && shareExtConf.buildSettings) {
            // Copy ASSETCATALOG_COMPILER_APPICON_NAME if it exists in main target
            if (mainConf.buildSettings.ASSETCATALOG_COMPILER_APPICON_NAME) {
              var assetIconName = mainConf.buildSettings.ASSETCATALOG_COMPILER_APPICON_NAME;
              log('Setting ASSETCATALOG_COMPILER_APPICON_NAME: ' + assetIconName);
              shareExtConf.buildSettings.ASSETCATALOG_COMPILER_APPICON_NAME = assetIconName;
            }
          }
        });
      }
    });

    // Write the updated project file
    fs.writeFileSync(pbxProjectPath, pbxProject.writeSync());
    log('Successfully configured icons for ShareExtension target');

  } catch (err) {
    log('Warning: Icon configuration encountered an issue: ' + err.message);
    log('You may need to manually configure icons in Xcode for the ShareExt target.');
  }
};
