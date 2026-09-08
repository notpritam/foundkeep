import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Foundkeep mobile config pins the release identity and safe OTA runtime', async () => {
  const app = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8')).expo;
  assert.equal(app.name, 'Foundkeep');
  assert.equal(app.slug, 'foundkeep');
  assert.equal(app.version, '1.0.0');
  assert.equal(app.scheme, 'foundkeep');
  assert.equal(app.ios.bundleIdentifier, 'app.foundkeep.ios');
  assert.equal(app.ios.buildNumber, '1');
  assert.equal(app.ios.supportsTablet, false);
  assert.ok(app.ios.associatedDomains.includes('applinks:foundkeep.app'));
  assert.deepEqual(app.runtimeVersion, { policy: 'fingerprint' });
  assert.equal(app.updates.checkAutomatically, 'ON_LOAD');
  assert.equal(app.updates.fallbackToCacheTimeout, 0);
  assert.equal(app.updates.url, 'https://u.expo.dev/33362145-2b45-4d86-bb08-cd10c6bfae61');
  assert.equal(app.extra.eas.projectId, '33362145-2b45-4d86-bb08-cd10c6bfae61');
  assert.equal(app.ios.infoPlist.ITSAppUsesNonExemptEncryption, false);
  assert.equal(app.ios.infoPlist.NSPhotoLibraryUsageDescription, undefined);
  assert.equal(app.ios.privacyManifests.NSPrivacyTracking, false);
  assert.deepEqual(
    app.ios.privacyManifests.NSPrivacyAccessedAPITypes.find(
      item => item.NSPrivacyAccessedAPIType === 'NSPrivacyAccessedAPICategoryUserDefaults',
    )?.NSPrivacyAccessedAPITypeReasons,
    ['1C8F.1'],
  );
  assert.ok(app.ios.privacyManifests.NSPrivacyCollectedDataTypes.some(item => item.NSPrivacyCollectedDataType === 'NSPrivacyCollectedDataTypeBrowsingHistory'));
  assert.equal(app.ios.privacyManifests.NSPrivacyCollectedDataTypes.find(item => item.NSPrivacyCollectedDataType === 'NSPrivacyCollectedDataTypeDeviceID')?.NSPrivacyCollectedDataTypeLinked, true);
  assert.ok(app.plugins.includes('expo-router'));
  assert.ok(app.plugins.includes('expo-updates'));
  assert.ok(app.plugins.includes('expo-notifications'));
  assert.doesNotMatch(JSON.stringify(app), /token|password|secret/i);
});

test('EAS profiles separate development, preview and production update channels', async () => {
  const eas = JSON.parse(await readFile(new URL('../eas.json', import.meta.url), 'utf8'));
  assert.equal(eas.build.development.developmentClient, true);
  assert.equal(eas.build.development.channel, 'development');
  assert.equal(eas.build.preview.channel, 'preview');
  assert.equal(eas.build.production.channel, 'production');
  assert.equal(eas.build.production.autoIncrement, true);
});
