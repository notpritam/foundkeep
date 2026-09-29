#!/usr/bin/env node
// Publish captured FoundKeep UI states to Pritam's Launchpad design workspace.
//
//   /usr/bin/node scripts/design/launchpad-publish.mjs <manifest.json> [more.json…]
//
// A manifest is { items: [...], flows?: [...] }:
//   item: { kind: 'screen'|'component', name, state, variant?, description?, usage?,
//           category?: 'primitive'|'component'|'pattern' (components),
//           image?: '/abs/path.jpg|png|webp'  (rendered full-bleed), html?: '<…>' }
//   flow: { name, scenarios: [{ id, name, steps: ['Screen name', …] }] }
// Artifacts are matched by kind + name: an unchanged item is skipped, a changed one
// gets a new revision, a new one is created. Launchpad rejects stale writes with
// 409, so every write re-reads the project and retries.
//
// The agent token is read from ~/.config/launchpad/foundkeep-agent.env and never
// printed or passed on a command line.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { extname, join } from 'node:path';
import { createHash } from 'node:crypto';

const URL_BASE = process.env.LAUNCHPAD_URL || 'http://127.0.0.1:9053';
const PROJECT = process.env.LAUNCHPAD_PROJECT || 'f4da6315755bcbafffde0f5b90dbbd8d0f58fbd1c2bdfa7d';
const ENV_FILE = process.env.LAUNCHPAD_ENV_FILE || join(homedir(), '.config/launchpad/foundkeep-agent.env');
const token = readFileSync(ENV_FILE, 'utf8').split('\n')
  .map((line) => line.match(/^\s*LAUNCHPAD_TOKEN\s*=\s*(['"]?)([^'"\n]+)\1\s*$/)?.[2]).find(Boolean);
if (!token) throw new Error(`LAUNCHPAD_TOKEN missing in ${ENV_FILE}`);

async function api(path, json) {
  const response = await fetch(`${URL_BASE}/api/projects/${PROJECT}${path}`, {
    method: json === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, ...(json === undefined ? {} : { 'content-type': 'application/json' }) },
    body: json === undefined ? undefined : JSON.stringify(json),
  });
  const text = await response.text();
  if (!response.ok) { const error = new Error(`Launchpad ${response.status}: ${text.slice(0, 300)}`); error.status = response.status; throw error; }
  return text ? JSON.parse(text) : null;
}
const read = () => api('');

// Send one command against the current project version, retrying stale writes.
async function command(body) {
  for (let attempt = 0; ; attempt++) {
    const project = await read();
    try { return await api('/commands', { expectedVersion: project.version, ...body }); }
    catch (error) { if (error.status !== 409 || attempt >= 8) throw error; await new Promise((r) => setTimeout(r, 150 + Math.random() * 400)); }
  }
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
function imageHtml(path, alt) {
  const data = readFileSync(path).toString('base64');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<style>html,body{margin:0;background:#0b0c0d}img{display:block;width:100%;height:auto}</style></head>`
    + `<body><img alt="${alt.replace(/"/g, '&quot;')}" src="data:${MIME[extname(path).toLowerCase()] || 'image/png'};base64,${data}"></body></html>`;
}
// Compare only what a reviewer sees; the server may add or reorder fields.
const FIELDS = ['html', 'state', 'variant', 'description', 'usage', 'category', 'nodes', 'edges', 'scenarios'];
const digest = (value) => createHash('sha256').update(JSON.stringify(FIELDS.map((key) => value?.[key] ?? null))).digest('hex');

function latest(project, artifactId) {
  const revisions = (project.revisions || []).filter((r) => r.artifactId === artifactId);
  return revisions.at(-1) || null;
}

async function publishItem(item) {
  if (!['screen', 'component'].includes(item.kind) || !item.name) throw new Error(`Bad item: ${JSON.stringify(item).slice(0, 120)}`);
  const html = item.html || (item.image ? imageHtml(item.image, item.name) : null);
  if (!html) throw new Error(`${item.name}: needs html or image`);
  const content = { html, state: item.state || 'Default', ...(item.variant ? { variant: item.variant } : {}),
    ...(item.description ? { description: item.description } : {}), ...(item.usage ? { usage: item.usage } : {}),
    ...(item.kind === 'component' ? { category: item.category || 'component' } : {}) };
  const project = await read();
  const artifact = (project.artifacts || []).find((a) => a.kind === item.kind && a.name === item.name);
  if (artifact) {
    const current = latest(project, artifact.id);
    if (current && digest(current.content) === digest(content)) return { name: item.name, action: 'unchanged', artifactId: artifact.id };
    await command({ type: 'revision.create', artifactId: artifact.id, content, dependencies: current?.dependencies || [] });
    return { name: item.name, action: 'revised', artifactId: artifact.id };
  }
  const next = await command({ type: 'artifact.create', kind: item.kind, name: item.name, content });
  const created = next.artifacts.find((a) => a.kind === item.kind && a.name === item.name);
  return { name: item.name, action: 'created', artifactId: created.id };
}

async function publishFlow(flow) {
  const project = await read();
  const screenId = (name) => {
    const found = project.artifacts.find((a) => a.kind === 'screen' && a.name === name);
    if (!found) throw new Error(`Flow "${flow.name}": no screen named "${name}"`);
    return found.id;
  };
  const order = [...new Set(flow.scenarios.flatMap((s) => s.steps))];
  const nodes = order.map((name, index) => ({ screenId: screenId(name), x: 80 + (index % 4) * 360, y: 80 + Math.floor(index / 4) * 520 }));
  const edges = [];
  for (const scenario of flow.scenarios)
    scenario.steps.slice(1).forEach((name, index) => {
      const from = screenId(scenario.steps[index]), to = screenId(name);
      if (!edges.some((e) => e.from === from && e.to === to)) edges.push({ id: `${scenario.id}-${index}`, from, to, label: scenario.name });
    });
  const content = { nodes, edges, scenarios: flow.scenarios.map((s) => ({ id: s.id, name: s.name, startScreenId: screenId(s.steps[0]) })) };
  const artifact = project.artifacts.find((a) => a.kind === 'flow' && a.name === flow.name);
  if (artifact) {
    const current = latest(project, artifact.id);
    if (current && digest(current.content) === digest(content)) return { name: flow.name, action: 'unchanged' };
    await command({ type: 'revision.create', artifactId: artifact.id, content, dependencies: [] });
    return { name: flow.name, action: 'revised' };
  }
  await command({ type: 'artifact.create', kind: 'flow', name: flow.name, content });
  return { name: flow.name, action: 'created' };
}

const manifests = process.argv.slice(2);
if (!manifests.length) throw new Error('Usage: launchpad-publish.mjs <manifest.json> [...]');
for (const file of manifests) {
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  for (const item of manifest.items || []) console.log(JSON.stringify(await publishItem(item)));
  for (const flow of manifest.flows || []) console.log(JSON.stringify(await publishFlow(flow)));
}
