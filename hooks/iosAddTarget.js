const fs = require('fs');
const path = require('path');

const {
  PLUGIN_ID,
  iosFolder,
  getPreferences,
  findXCodeproject,
  replacePreferencesInFile,
  log, redError,
} = require('./utils');

// Return the list of files in the share extension project, organized by type
const FILE_TYPES = {
  '.h':'source',
  '.m':'source',
  '.plist':'config',
  '.entitlements':'config',
};

function parsePbxProject(context, pbxProjectPath) {
  var xcode = require('xcode');
  log(`Parsing existing project at location: ${pbxProjectPath}…`);

  var pbxProject;

  if (context.opts.cordova.project) {
    pbxProject = context.opts.cordova.project.parseProjectFile(context.opts.projectRoot).xcode;
  } else {
    pbxProject = xcode.project(pbxProjectPath);
    pbxProject.parseSync();
  }

  return pbxProject;
}

function forEachShareExtensionFile(context, callback) {
  var shareExtensionFolder = path.join(iosFolder(context), 'ShareExtension');
  fs.readdirSync(shareExtensionFolder).forEach(function(name) {
    // Ignore junk files like .DS_Store
    if (!/^\..*/.test(name)) {
      callback({
        name: name,
        path: path.join(shareExtensionFolder, name),
        extension: path.extname(name)
      });
    }
  });
}

function getShareExtensionFiles(context) {
  var files = { source: [], config: [], resource: [] };

  forEachShareExtensionFile(context, function(file) {
    var fileType = FILE_TYPES[file.extension] || 'resource';
    files[fileType].push(file);
  });

  return files;
}

module.exports = function(context) {
  log('Adding ShareExt target to XCode project')

  var deferral = require('q').defer();

  findXCodeproject(context, function(projectFolder, projectName) {
    var preferences = getPreferences(context, projectName);

    var pbxProjectPath = path.join(projectFolder, 'project.pbxproj');
    var pbxProject = parsePbxProject(context, pbxProjectPath);

    var files = getShareExtensionFiles(context);
    files.config.concat(files.source).forEach(function(file) {
      replacePreferencesInFile(file.path, preferences);
    });

    // Find if the project already contains the target and group
    var target = pbxProject.pbxTargetByName('ShareExt') || pbxProject.pbxTargetByName('"ShareExt"');
    if (target) { log('ShareExt target already exists') }

    if (!target) {
      // Add PBXNativeTarget to the project
      target = pbxProject.addTarget('ShareExt', 'app_extension', 'ShareExtension');

      // Add a new PBXSourcesBuildPhase for our ShareViewController
      // (we can't add it to the existing one because an extension is kind of an extra app)
      pbxProject.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);

      // Add a new PBXResourcesBuildPhase for the Resources used by the Share Extension
      // (MainInterface.storyboard)
      pbxProject.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    }

    // Create a separate PBXGroup for the shareExtensions files, name has to be unique and path must be in quotation marks
    var pbxGroupKey = pbxProject.findPBXGroupKey({name: 'ShareExtension'});
    if (pbxGroupKey) {
      log('ShareExtension group already exists')
    } else {
      pbxGroupKey = pbxProject.pbxCreateGroup('ShareExtension', 'ShareExtension');

      // Add the PbxGroup to cordovas "CustomTemplate"-group
      var customTemplateKey = pbxProject.findPBXGroupKey({name: 'CustomTemplate'});
      pbxProject.addToPbxGroup(pbxGroupKey, customTemplateKey);
    }

    // Add files which are not part of any build phase (config)
    // NOTE: guarded with hasFile() so re-running this hook (e.g. because a
    // future Cordova/MABS version reintroduces an extra trigger, or plugman
    // retries an install) never appends duplicate PBXFileReference /
    // PBXBuildFile / group-children entries for the same physical file.
    // Unbounded duplication of these objects is what eventually produces
    // "Expected ... but "," found" when some later step re-parses the file.
    files.config.forEach(function (file) {
      if (!pbxProject.hasFile(file.name)) {
        pbxProject.addFile(file.name, pbxGroupKey);
      }
    });

    // Add source files to our PbxGroup and our newly created PBXSourcesBuildPhase
    files.source.forEach(function(file) {
      if (!pbxProject.hasFile(file.name)) {
        pbxProject.addSourceFile(file.name, {target: target.uuid}, pbxGroupKey);
      }
    });

    //  Add the resource file and include it into the targest PbxResourcesBuildPhase and PbxGroup
    files.resource.forEach(function(file) {
      if (!pbxProject.hasFile(file.name)) {
        pbxProject.addResourceFile(file.name, {target: target.uuid}, pbxGroupKey);
      }
    });

    // Add build settings for Swift support, bridging header and xcconfig files
    var configurations = pbxProject.pbxXCBuildConfigurationSection();
    for (var key in configurations) {
      if (typeof configurations[key].buildSettings !== 'undefined') {
        var buildSettingsObj = configurations[key].buildSettings;
        if (typeof buildSettingsObj['PRODUCT_NAME'] !== 'undefined') {
          var productName = buildSettingsObj['PRODUCT_NAME'];
          if (productName.indexOf('ShareExt') >= 0) {
            buildSettingsObj['CODE_SIGN_ENTITLEMENTS'] = '"ShareExtension/ShareExtension.entitlements"';
          }
        }
      }
    }

    // Write the modified project back to disc.
    //
    // IMPORTANT: when context.opts.cordova.project exists, pbxProject is the
    // SAME in-memory object Cordova itself caches for the whole plugin
    // install pipeline (see cordova-ios/lib/projectFile.js -
    // cachedProjectFiles). Cordova owns writing/purging that object on its
    // own schedule as later plugins are installed. Writing to disk here too
    // creates a race between this hook's write and Cordova's own write of
    // the same evolving in-memory tree, which can leave the file on disk in
    // a state that doesn't match what Cordova still thinks is cached -
    // surfacing as a parse failure several plugins later rather than here.
    //
    // So: only write directly when we parsed the project ourselves
    // (standalone path, e.g. when running outside cordova-ios's Api). When
    // using Cordova's shared project, just mark it dirty and let Cordova
    // persist it through its normal lifecycle.
    if (context.opts.cordova.project) {
      if (typeof context.opts.cordova.project.write === 'function') {
        context.opts.cordova.project.write();
      }
    } else {
      fs.writeFileSync(pbxProjectPath, pbxProject.writeSync());
    }

    // Fail fast: immediately re-parse what's now on disk. If our own edits
    // are what corrupt the project, this throws right here (with a clear
    // origin) instead of silently succeeding and blowing up two plugins
    // later inside es6-promise-plugin's install.
    try {
      var verify = require('xcode').project(pbxProjectPath);
      verify.parseSync();
    } catch (verifyErr) {
      throw redError('project.pbxproj became unparsable immediately after ' +
        'iosAddTarget.js ran. This confirms the corruption originates here, ' +
        'not in a later plugin. Original error: ' + verifyErr.message);
    }

    log('Successfully added ShareExt target to XCode project')

    deferral.resolve();
  });

  return deferral.promise;
};
