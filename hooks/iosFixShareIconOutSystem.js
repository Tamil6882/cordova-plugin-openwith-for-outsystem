const fs = require('fs');
const path = require('path');

const {
  log,
  redError,
} = require('./utils');

/**
 * OutSystem-specific iOS ShareExtension icon configuration hook.
 * 
 * This hook ensures that app icons are properly configured for the ShareExtension
 * target in OutSystem builds. It copies icon asset configurations from the main
 * app target to the ShareExt target, which is critical for icons to appear in
 * the iOS share menu.
 * 
 * This is particularly important for OutSystem because:
 * 1. OutSystem builds may not preserve icon settings across targets
 * 2. The asset catalog needs explicit configuration for share extensions
 * 3. Build hook execution timing is critical in OutSystem's build pipeline
 */
module.exports = function(context) {
  log('Configuring iOS ShareExtension icons for OutSystem build');

  try {
    const xcode = require('xcode');
    const projectFolder = path.join(context.opts.projectRoot, 'platforms', 'ios');
    
    // Find the Xcode project
    const projectName = fs.readdirSync(projectFolder).find(name => name.endsWith('.xcodeproj'));
    
    if (!projectName) {
      log('Warning: Could not find .xcodeproj file in OutSystem build');
      return;
    }

    const pbxProjectPath = path.join(projectFolder, projectName, 'project.pbxproj');
    
    if (!fs.existsSync(pbxProjectPath)) {
      log('Warning: project.pbxproj not found at ' + pbxProjectPath);
      return;
    }

    const pbxProject = xcode.project(pbxProjectPath);
    pbxProject.parseSync();

    // Get target names
    const mainTargetName = projectName.replace('.xcodeproj', '');
    const shareExtTargetName = 'ShareExt';

    // Find targets
    const mainTarget = pbxProject.pbxTargetByName(mainTargetName) || 
                       pbxProject.pbxTargetByName('"' + mainTargetName + '"');
    const shareExtTarget = pbxProject.pbxTargetByName(shareExtTargetName) || 
                          pbxProject.pbxTargetByName('"' + shareExtTargetName + '"');

    if (!mainTarget) {
      log('Warning: Main target "' + mainTargetName + '" not found');
      return;
    }

    if (!shareExtTarget) {
      log('Warning: ShareExtension target "' + shareExtTargetName + '" not found');
      return;
    }

    log('Found main target: ' + mainTargetName);
    log('Found ShareExt target: ' + shareExtTargetName);

    // Get build configuration sections
    const buildConfigSection = pbxProject.pbxXCBuildConfigurationSection();
    const configLists = pbxProject.pbxXCConfigurationList();

    // Get configuration lists for both targets
    const mainConfigListUuid = mainTarget.pbxNativeTarget.buildConfigurationList;
    const shareExtConfigListUuid = shareExtTarget.pbxNativeTarget.buildConfigurationList;

    const mainConfigList = configLists[mainConfigListUuid];
    const shareExtConfigList = configLists[shareExtConfigListUuid];

    if (!mainConfigList || !shareExtConfigList) {
      log('Warning: Could not locate build configuration lists for OutSystem project');
      return;
    }

    let iconsCopied = 0;

    // Copy icon settings from main target to ShareExt target
    mainConfigList.buildConfigurations.forEach(function(mainConfRef) {
      const mainConf = buildConfigSection[mainConfRef.value];
      
      if (mainConf && mainConf.buildSettings) {
        const iconName = mainConf.buildSettings.ASSETCATALOG_COMPILER_APPICON_NAME;
        
        if (iconName) {
          log('Found icon asset name in main target: ' + iconName);
          
          // Find corresponding configuration in ShareExt
          shareExtConfigList.buildConfigurations.forEach(function(shareExtConfRef) {
            const shareExtConf = buildConfigSection[shareExtConfRef.value];
            
            if (shareExtConf && shareExtConf.buildSettings) {
              log('Copying icon to ShareExt configuration: ' + shareExtConfRef.value);
              shareExtConf.buildSettings.ASSETCATALOG_COMPILER_APPICON_NAME = iconName;
              iconsCopied++;
            }
          });
        } else {
          log('Warning: No ASSETCATALOG_COMPILER_APPICON_NAME found in main target configuration');
          // Fallback: set default icon name
          shareExtConfigList.buildConfigurations.forEach(function(shareExtConfRef) {
            const shareExtConf = buildConfigSection[shareExtConfRef.value];
            if (shareExtConf && shareExtConf.buildSettings) {
              log('Setting default icon name for ShareExt: AppIcon');
              shareExtConf.buildSettings.ASSETCATALOG_COMPILER_APPICON_NAME = 'AppIcon';
              iconsCopied++;
            }
          });
        }
      }
    });

    // Write updated project file
    fs.writeFileSync(pbxProjectPath, pbxProject.writeSync());
    log('✓ Successfully configured ' + iconsCopied + ' icon settings for ShareExtension target');

  } catch (err) {
    log('Error during OutSystem iOS icon configuration: ' + err.message);
    log('Stack: ' + err.stack);
    // Don't throw - allow build to continue
  }
};
