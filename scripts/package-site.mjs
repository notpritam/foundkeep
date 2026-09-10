import {cp, mkdir, readFile, writeFile, access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

// Package an already verified standalone build. Immutable release directories
// allow the service to switch atomically without rebuilding a running process.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRequire = createRequire(path.join(root, 'apps/site/package.json'));
const destination = process.argv[2];
if (!destination || !path.isAbsolute(destination)) throw new Error('Supply a new absolute release directory.');
try { await access(destination); throw new Error('The release directory already exists. Choose a new release.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const build = path.join(root, 'apps/site/.next');
await access(path.join(build, 'standalone/apps/site/server.js'));
await mkdir(path.dirname(destination), {recursive: true});
await cp(path.join(build, 'standalone'), destination, {recursive: true, dereference: true});
const site = path.join(destination, 'apps/site');
// This workspace also contains Expo, whose root React version differs. Next's
// hoisted server runtime must resolve this site's React peers after relocation,
// including peers omitted by tracing an external workspace dependency symlink.
for (const peer of ['react', 'react-dom']) {
  await cp(path.dirname(siteRequire.resolve(`${peer}/package.json`)), path.join(destination, 'node_modules', peer), {recursive: true, dereference: true});
}
await cp(path.join(build, 'static'), path.join(site, '.next/static'), {recursive: true});
// public/assets points to the shared first-party assets in apps/web. Resolve
// that link so the release has no dependency on a mutable source checkout.
await cp(path.join(root, 'apps/site/public'), path.join(site, 'public'), {recursive: true, dereference: true});
await writeFile(path.join(destination, 'release.json'), JSON.stringify({
  revision: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
  buildId: (await readFile(path.join(build, 'BUILD_ID'), 'utf8')).trim(),
  createdAt: new Date().toISOString(),
}, null, 2) + '\n');
console.log(destination);
