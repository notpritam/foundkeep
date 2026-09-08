const fs = require('node:fs');
const path = require('node:path');
const { withXcodeProject } = require('expo/config-plugins');

const TARGET_NAME = 'FoundkeepShare';
const BUNDLE_IDENTIFIER = 'app.foundkeep.ios.ShareExtension';
const SOURCE_FILES = ['ShareViewController.swift', 'ShareItemLoader.swift', 'ShareUploader.swift', 'SharePolicy.swift'];
const RESOURCE_FILES = ['SafariPreprocessor.js', 'PrivacyInfo.xcprivacy'];
const ALL_FILES = ['Info.plist', 'FoundkeepShare.entitlements', ...SOURCE_FILES, ...RESOURCE_FILES];

function copyNativeSources(projectRoot, platformProjectRoot) {
  const source = path.join(projectRoot, 'share-extension');
  const target = path.join(platformProjectRoot, TARGET_NAME);
  fs.mkdirSync(target, { recursive: true });
  for (const file of ALL_FILES) fs.copyFileSync(path.join(source, file), path.join(target, file));
}

function addTopLevelGroup(project, files) {
  const { uuid } = project.addPbxGroup(files, TARGET_NAME, TARGET_NAME);
  const groups = project.hash.project.objects.PBXGroup;
  const mainGroup = project.getFirstProject().firstProject.mainGroup;
  if (groups[mainGroup]) {
    groups[mainGroup].children.push({ value: uuid, comment: TARGET_NAME });
    return;
  }
  throw new Error('Foundkeep could not locate the main Xcode project group.');
}

function configureTarget(project, target) {
  const configurationList = project.pbxXCConfigurationList()[target.pbxNativeTarget.buildConfigurationList];
  const configurations = project.pbxXCBuildConfigurationSection();
  for (const entry of configurationList.buildConfigurations) {
    const settings = configurations[entry.value].buildSettings;
    Object.assign(settings, {
      APPLICATION_EXTENSION_API_ONLY: 'YES',
      CLANG_ENABLE_MODULES: 'YES',
      CODE_SIGN_ENTITLEMENTS: `${TARGET_NAME}/FoundkeepShare.entitlements`,
      CURRENT_PROJECT_VERSION: '1',
      GENERATE_INFOPLIST_FILE: 'NO',
      INFOPLIST_FILE: `${TARGET_NAME}/Info.plist`,
      IPHONEOS_DEPLOYMENT_TARGET: '15.1',
      MARKETING_VERSION: '1.0.0',
      PRODUCT_BUNDLE_IDENTIFIER: `"${BUNDLE_IDENTIFIER}"`,
      PRODUCT_NAME: `"${TARGET_NAME}"`,
      SKIP_INSTALL: 'YES',
      SUPPORTS_MACCATALYST: 'NO',
      SWIFT_VERSION: '5.0',
      TARGETED_DEVICE_FAMILY: '"1"',
    });
  }
  project.addTargetAttribute('ProvisioningStyle', 'Automatic', target.uuid);
}

module.exports = function withFoundkeepShareExtension(config) {
  return withXcodeProject(config, mod => {
    const project = mod.modResults;
    copyNativeSources(mod.modRequest.projectRoot, mod.modRequest.platformProjectRoot);
    if (project.findTargetKey(TARGET_NAME)) return mod;

    const target = project.addTarget(TARGET_NAME, 'app_extension', TARGET_NAME, BUNDLE_IDENTIFIER);
    addTopLevelGroup(project, ALL_FILES);
    project.addBuildPhase(SOURCE_FILES, 'PBXSourcesBuildPhase', 'Sources', target.uuid, 'app_extension');
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid, 'app_extension');
    project.addBuildPhase(RESOURCE_FILES, 'PBXResourcesBuildPhase', 'Resources', target.uuid, 'app_extension');
    configureTarget(project, target);
    return mod;
  });
};
