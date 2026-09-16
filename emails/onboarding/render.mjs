// Render the onboarding templates with sample values into ./preview/ so they can
// be opened in a browser. Usage: node render.mjs   (use /usr/bin/node on omni)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const sample = {
  name: 'Alex',
  dashboardUrl: 'https://foundkeep.app/dashboard',
  helpUrl: 'https://help.foundkeep.app/',
  connectUrl: 'https://foundkeep.app/connect',
  unsubscribeUrl: 'https://foundkeep.app/dashboard/settings#email',
};
const fill = (s) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in sample ? sample[k] : `{{${k}}}`));

const emails = [
  { file: '01-welcome.html', label: 'Day 0 · Welcome' },
  { file: '02-organize.html', label: 'Day 2 · Let it organize itself' },
  { file: '03-agents.html', label: 'Day 7 · Give your AI a memory' },
];

await mkdir(path.join(dir, 'preview'), { recursive: true });
for (const e of emails) {
  const html = fill(await readFile(path.join(dir, e.file), 'utf8'));
  await writeFile(path.join(dir, 'preview', e.file), html);
}
const index = `<!doctype html><meta charset="utf-8"><title>FoundKeep onboarding preview</title>
<body style="font-family:system-ui;max-width:680px;margin:2rem auto;padding:0 1rem;">
<h1>FoundKeep onboarding drip — preview</h1>
<p>Rendered with sample values. These are the designed templates; sending is wired later (see SEND_PLAN.md).</p>
<ul style="line-height:2;font-size:1.05rem;">
${emails.map((e) => `<li><a href="./${e.file}">${e.label}</a></li>`).join('\n')}
</ul></body>`;
await writeFile(path.join(dir, 'preview', 'index.html'), index);
console.log('Wrote preview/ — open preview/index.html');
