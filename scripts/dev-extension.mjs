#!/usr/bin/env node
// Build the dev extension (FoundKeep Dev, synced to dev.foundkeep.app) and
// hand it to Pritam two ways:
//   - a download in the design system: /downloads/foundkeep-extension-dev.zip
//     on the Storybook server (omni :8814, shared with bb Connect);
//   - with --mac, an in-place update of ~/Downloads/foundkeep-extension-dev on
//     the MacBook: load that folder once with "Load unpacked", then every
//     update is just the reload button in chrome://extensions.
//
//   /usr/bin/node scripts/dev-extension.mjs [--mac] [--host <bb host id>]
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const toMac = args.includes('--mac');
const host = args.includes('--host') ? args[args.indexOf('--host') + 1] : 'host_8m9cj45pg3'; // MacBook Pro Work
const MAC_DOWNLOADS = '/Users/notpritamm/Downloads', FOLDER = 'foundkeep-extension-dev';
const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'], ...opts });

// 1. Build.
run('/usr/bin/node', ['deploy/build-extension.mjs', '--environment', 'dev']);
const zip = path.join(root, 'deploy/dist/extensions/dev/foundkeep-extension-dev.zip');
const bytes = await readFile(zip);
const sha = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
const manifest = JSON.parse(run('unzip', ['-p', zip, `${FOLDER}/manifest.json`]));
const commit = run('git', ['rev-parse', '--short', 'HEAD']).trim();
console.log(`Built ${manifest.name} ${manifest.version} (${commit}, sha ${sha})`);

// 2. The download, served with the design system.
const downloads = path.join(root, 'design-system/downloads');
await mkdir(downloads, { recursive: true });
await copyFile(zip, path.join(downloads, 'foundkeep-extension-dev.zip'));
await writeFile(path.join(downloads, 'foundkeep-extension-dev.json'), JSON.stringify({ name: manifest.name, version: manifest.version, commit, sha, built: new Date().toISOString() }, null, 2) + '\n');
run('/usr/bin/node', ['node_modules/.bin/storybook', 'build', '-o', 'dist', '--quiet'], { cwd: path.join(root, 'design-system'), stdio: ['pipe', 'pipe', 'pipe'] });
console.log('Download: https://omni--8814.getbb.app/downloads/foundkeep-extension-dev.zip');

// 3. The Mac: replace the folder Chrome loads, in place.
if (toMac) {
  const b64 = `${MAC_DOWNLOADS}/${FOLDER}.zip.b64`, shaFile = `${MAC_DOWNLOADS}/${FOLDER}.sha`;
  run('bb', ['file', 'write', b64, '--host', host, '--create-parents', '--stdin'], { input: bytes.toString('base64') });
  try { run('bb', ['file', 'remove', shaFile, '--host', host], { stdio: ['pipe', 'pipe', 'pipe'] }); } catch { /* first update */ }
  const script = [
    'set -e', `cd ${MAC_DOWNLOADS}`,
    `base64 -D -i ${FOLDER}.zip.b64 -o ${FOLDER}.zip`, `rm ${FOLDER}.zip.b64`,
    `rm -rf ${FOLDER}.next && mkdir ${FOLDER}.next && unzip -q ${FOLDER}.zip -d ${FOLDER}.next`,
    // Swap the folder contents; the path Chrome loads stays the same.
    `rm -rf ${FOLDER} && mv ${FOLDER}.next/${FOLDER} ${FOLDER} && rmdir ${FOLDER}.next`,
    `shasum -a 256 ${FOLDER}.zip | cut -c1-16 > ${FOLDER}.sha`,
  ].join('; ');
  run('bb', ['terminal', 'create', '--machine', host, '--cwd', MAC_DOWNLOADS, '--title', 'FoundKeep dev extension update', '--json', '--command', `bash -c "${script}"`]);
  let seen = '';
  for (let i = 0; i < 40 && !seen; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    try { seen = run('bb', ['file', 'read', shaFile, '--host', host], { stdio: ['pipe', 'pipe', 'pipe'] }).trim(); } catch { /* not written yet */ }
  }
  if (seen !== sha) throw new Error(`Mac copy did not verify (expected ${sha}, got ${seen || 'nothing'})`);
  console.log(`Mac: ~/Downloads/${FOLDER} updated and verified (${sha}). Reload FoundKeep Dev in chrome://extensions.`);
}
