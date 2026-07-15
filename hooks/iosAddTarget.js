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
    // Guarded with hasFile() so re-running this hook never appends duplicate
    // PBXFileReference / PBXBuildFile / group-children entries for the same
    // physical file.
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

    // ---------------------------------------------------------------------
    // FIX #1: CODE_SIGN_ENTITLEMENTS quoting
    //
    // The previous version did:
    //   buildSettingsObj['CODE_SIGN_ENTITLEMENTS'] = '"ShareExtension/ShareExtension.entitlements"';
    // i.e. it embedded literal double-quote characters INSIDE the JS string
    // value itself. The `xcode` module's own serializer already decides
    // whether a build-setting value needs quoting when it writes the file
    // (values containing "/" do get quoted automatically). Pre-quoting the
    // value ourselves means the on-disk value can end up double-quoted, or
    // quoted in a way that a later full re-parse (triggered by installing
    // another plugin) can't tokenize correctly - producing exactly the
    // "Expected ... but "," found" PEG parser error seen several plugins
    // later.
    //
    // Fix: assign the RAW value (no manual quotes) and go through the
    // xcode module's own updateBuildProperty API instead of mutating the
    // parsed buildSettings object directly. This keeps quoting/escaping
    // consistent with whatever version of `xcode` is doing the writing,
    // instead of us guessing at its on-disk format.
    // ---------------------------------------------------------------------
    pbxProject.updateBuildProperty(
      'CODE_SIGN_ENTITLEMENTS',
      'ShareExtension/ShareExtension.entitlements',
      null,
      'ShareExt'
    );

    // ---------------------------------------------------------------------
    // FIX #2: deterministic write + verify
    //
    // Previously, when running inside Cordova's own plugin-install pipeline
    // (context.opts.cordova.project set), this hook called
    // context.opts.cordova.project.write() and relied on Cordova's own
    // scheduling to eventually flush bytes to disk - then immediately
    // re-parsed pbxProjectPath from disk to "verify" the write succeeded.
    // If Cordova's write() does not flush synchronously, that verify step
    // can read stale/partial content and pass even when the in-memory tree
    // (which Cordova will still write out later, on its own schedule) is
    // actually corrupted - producing a false "all good" here and a real
    // failure several plugins later.
    //
    // Fix: write the CURRENT in-memory state (pbxProject is the same object
    // Cordova has cached either way - see parsePbxProject above) to disk
    // ourselves, synchronously, right now, using pbxProject.writeSync().
    // This is idempotent: if Cordova later writes the same cached object
    // again from its own lifecycle, it will serialize the same content we
    // just wrote, so there's no conflicting write. This removes the
    // write-timing ambiguity instead of just working around it.
    // ---------------------------------------------------------------------
    fs.writeFileSync(pbxProjectPath, pbxProject.writeSync());

    // Fail fast: immediately re-parse what's now on disk, using a fresh
    // xcode.project instance (not the cached/shared one) so this is a true
    // independent check of what we just wrote - not a check that could
    // silently reuse in-memory state.
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
