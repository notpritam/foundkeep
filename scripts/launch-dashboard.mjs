import {readFile, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Render the launch tracker. docs/launch/roadmap.json is the only source of
// truth; dashboard.html and STATUS.md are generated from it and never edited by
// hand. `--refresh` also re-reads production usage (read-only) and the running
// release directories, which only works on omni.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'docs/launch');
const source = path.join(dir, 'roadmap.json');
const roadmap = JSON.parse(await readFile(source, 'utf8'));

const STATUSES = ['blocked', 'doing', 'todo', 'done'];
const LABEL = {done: 'Done', doing: 'In progress', todo: 'To do', blocked: 'Blocked'};
const ICON = {done: '✓', doing: '◐', todo: '○', blocked: '■'};

if (process.argv.includes('--refresh')) {
  roadmap.snapshot = {...roadmap.snapshot, ...(await refreshSnapshot())};
  await writeFile(source, `${JSON.stringify(roadmap, null, 2)}\n`);
}
validate(roadmap);
await writeFile(path.join(dir, 'dashboard.html'), html(roadmap));
await writeFile(path.join(dir, 'STATUS.md'), markdown(roadmap));
const s = summary(roadmap);
console.log(`launch readiness ${s.pct}% (${s.done}/${s.total} launch items done, ${s.needsYou} need Pritam)`);

function validate({phases, items}) {
  const phaseIds = new Set(phases.map((p) => p.id));
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.id)) throw new Error(`Duplicate item id ${item.id}`);
    seen.add(item.id);
    if (!phaseIds.has(item.phase)) throw new Error(`${item.id}: unknown phase ${item.phase}`);
    if (!STATUSES.includes(item.status)) throw new Error(`${item.id}: unknown status ${item.status}`);
    if (!['agent', 'pritam'].includes(item.owner)) throw new Error(`${item.id}: owner must be agent or pritam`);
  }
}

// Phases flagged `later` are post-launch and do not count toward readiness.
function summary({phases, items}) {
  const later = new Set(phases.filter((p) => p.later).map((p) => p.id));
  const launch = items.filter((i) => !later.has(i.phase));
  const done = launch.filter((i) => i.status === 'done').length;
  return {
    total: launch.length,
    done,
    pct: launch.length ? Math.round((done / launch.length) * 100) : 0,
    needsYou: launch.filter((i) => i.owner === 'pritam' && i.status !== 'done').length,
  };
}

function counts(items) {
  const c = {done: 0, doing: 0, todo: 0, blocked: 0};
  for (const i of items) c[i.status] += 1;
  return c;
}

async function refreshSnapshot() {
  const {DatabaseSync} = await import('node:sqlite');
  const dataDir = process.env.ATLAS_DATA_DIR ?? path.join(process.env.HOME, '.local/share/atlas');
  const db = new DatabaseSync(path.join(dataDir, 'atlas.db'), {readOnly: true});
  const one = (sql, ...args) => Object.values(db.prepare(sql).get(...args))[0];
  const since = (days) => Date.now() - days * 86_400_000;
  const metrics = {
    accounts: one('select count(*) from customer_accounts'),
    newAccounts7d: one('select count(*) from customer_accounts where created_at > ?', since(7)),
    active7d: one('select count(distinct account_id) from customer_captures where created_at > ?', since(7)),
    saves: one('select count(*) from customer_captures'),
    saves7d: one('select count(*) from customer_captures where created_at > ?', since(7)),
    collections: one('select count(*) from customer_collections'),
    paying: one("select count(*) from customer_subscriptions where status in ('active','trialing')"),
    openTickets: one("select count(*) from support_tickets where status != 'closed'"),
  };
  db.close();
  const release = (unit) => {
    try {
      const wd = execFileSync('systemctl', ['show', unit, '-p', 'WorkingDirectory', '--value'], {encoding: 'utf8'}).trim();
      return wd.match(/releases\/([^/]+)/)?.[1] ?? path.basename(path.dirname(wd));
    } catch { return 'unknown'; }
  };
  return {
    asOf: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
    metrics,
    releases: {
      ...roadmap.snapshot?.releases,
      prodBackend: release('atlas-backend.service'),
      devBackend: release('foundkeep-backend-dev.service'),
    },
  };
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
}
function compact(n) {
  return n >= 10_000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString('en-US');
}

function markdown(r) {
  const s = summary(r);
  const out = [
    `# ${r.title}`,
    '',
    `> Generated from \`roadmap.json\` by \`node scripts/launch-dashboard.mjs\` — edit the JSON, not this file.`,
    '',
    `**Goal:** ${r.goal}`,
    '',
    `**Launch readiness: ${s.pct}%** — ${s.done} of ${s.total} launch items done · ${s.needsYou} waiting on Pritam · updated ${r.updated}`,
    '',
  ];
  const m = r.snapshot?.metrics;
  if (m) {
    out.push(`**Production (${r.snapshot.asOf}):** ${m.accounts} accounts (${m.newAccounts7d} new in 7d) · ${m.active7d} active in 7d · ${m.saves} saves (${m.saves7d} in 7d) · ${m.paying} paying · ${m.openTickets} open tickets`, '');
  }
  if (r.asks) {
    const a = r.asks;
    out.push(`**Everything Pritam asked for (verified ${a.verified}):** ${a.total} asks — ${a.live} live · ${a.partial} partial · ${a.devOnly} dev-only · ${a.notBuilt} not built · ${a.parked} parked · ${a.superseded} superseded. The open ones are the ★ items below; full list in \`${a.inventory}\` (private).`, '');
  }
  out.push('| Phase | Progress | Done | In progress | To do | Blocked |', '|---|---|---|---|---|---|');
  for (const p of r.phases) {
    const c = counts(r.items.filter((i) => i.phase === p.id));
    const total = c.done + c.doing + c.todo + c.blocked;
    out.push(`| ${p.id} ${p.name}${p.later ? ' _(post-launch)_' : ''} | ${total ? Math.round((c.done / total) * 100) : 0}% | ${c.done} | ${c.doing} | ${c.todo} | ${c.blocked} |`);
  }
  out.push('');
  for (const p of r.phases) {
    out.push(`## ${p.id} · ${p.name}`, '', p.goal, '');
    if (p.exit) out.push(`_Exit criteria:_ ${p.exit}`, '');
    out.push('| | Item | Area | Owner | Note |', '|---|---|---|---|---|');
    for (const i of r.items.filter((x) => x.phase === p.id)) {
      out.push(`| ${ICON[i.status]} ${LABEL[i.status]} | ${i.asked ? '★ ' : ''}${i.title} | ${i.area} | ${i.owner === 'pritam' ? '**Pritam**' : 'agent'} | ${(i.note ?? '').replace(/\|/g, '\\|')} |`);
    }
    out.push('');
  }
  out.push('★ = asked for by Pritam in a FoundKeep thread.', '');
  return out.join('\n');
}

function html(r) {
  const s = summary(r);
  const m = r.snapshot?.metrics ?? {};
  const rel = r.snapshot?.releases ?? {};
  const tile = (label, value, sub) => `<div class="tile"><div class="tile-label">${esc(label)}</div><div class="tile-value">${compact(value ?? 0)}</div>${sub ? `<div class="tile-sub">${esc(sub)}</div>` : ''}</div>`;
  const phaseRows = r.phases.map((p) => {
    const items = r.items.filter((i) => i.phase === p.id);
    const c = counts(items);
    const total = items.length;
    const pct = total ? Math.round((c.done / total) * 100) : 0;
    const you = items.filter((i) => i.owner === 'pritam' && i.status !== 'done').length;
    return `<a class="phase" href="#${esc(p.id)}">
      <div class="phase-head"><span class="phase-id">${esc(p.id)}</span><span class="phase-name">${esc(p.name)}</span>${p.later ? '<span class="tag">post-launch</span>' : ''}<span class="phase-pct">${pct}%</span></div>
      <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${esc(p.name)} progress"><span style="width:${pct}%"></span></div>
      <div class="phase-counts">${c.done}/${total} done${c.doing ? ` · ${c.doing} in progress` : ''}${c.blocked ? ` · ${c.blocked} blocked` : ''}${you ? ` · <b>${you} need you</b>` : ''}</div>
    </a>`;
  }).join('');
  const sections = r.phases.map((p) => {
    const rows = r.items.filter((i) => i.phase === p.id).map((i) => `<tr data-id="${esc(i.id)}" data-status="${i.status}" data-owner="${i.owner}" data-area="${esc(i.area)}">
        <td><span class="status s-${i.status}"><i aria-hidden="true">${ICON[i.status]}</i>${LABEL[i.status]}</span></td>
        <td class="title">${i.asked ? '<span class="asked" title="Asked for by Pritam">★</span>' : ''}${esc(i.title)}${i.note ? `<div class="note">${esc(i.note)}</div>` : ''}</td>
        <td class="area">${esc(i.area)}</td>
        <td>${i.owner === 'pritam' ? '<span class="you">You</span>' : '<span class="agent">agent</span>'}</td>
      </tr>`).join('');
    return `<section class="phase-section" id="${esc(p.id)}">
      <h2><span class="phase-id">${esc(p.id)}</span> ${esc(p.name)}${p.later ? ' <span class="tag">post-launch</span>' : ''}</h2>
      <p class="goal">${esc(p.goal)}${p.exit ? `<br><span class="exit">Exit: ${esc(p.exit)}</span>` : ''}</p>
      <table><thead><tr><th>Status</th><th>Item</th><th>Area</th><th>Owner</th></tr></thead><tbody>${rows}</tbody></table>
    </section>`;
  }).join('');
  const areas = [...new Set(r.items.map((i) => i.area))].sort();
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(r.title)}</title>
<!-- Generated by scripts/launch-dashboard.mjs from roadmap.json. Do not edit. -->
<style>
:root{color-scheme:dark light;--bg:#08090a;--panel:#0f1011;--line:#1d1f22;--ink:#f7f8f8;--ink2:#a3a8b0;--ink3:#6b7079;--accent:#4cc38a;--track:rgba(76,195,138,.16);--good:#0ca30c;--warn:#fab219;--crit:#d03b3b}
@media (prefers-color-scheme:light){:root{--bg:#f6f7f7;--panel:#fff;--line:#e4e6e8;--ink:#101112;--ink2:#4a4f57;--ink3:#7a7f87;--accent:#0d7a50;--track:rgba(13,122,80,.14)}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1120px;margin:0 auto;padding:32px 20px 64px}
header{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:baseline;border-bottom:1px solid var(--line);padding-bottom:16px}
h1{font-size:18px;font-weight:600;margin:0}h2{font-size:15px;font-weight:600;margin:0 0 4px}
.meta{color:var(--ink3);font-size:12px}.goal{color:var(--ink2);margin:0 0 12px}.exit{color:var(--ink3);font-size:12px}
.hero{display:grid;grid-template-columns:minmax(220px,300px) 1fr;gap:16px;margin:20px 0;align-items:start}
.card,.tile,.phase{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px}
.hero-value{font-size:56px;font-weight:600;line-height:1;letter-spacing:-.02em}.hero-label{color:var(--ink2);margin-bottom:8px}.hero-sub{color:var(--ink2);margin-top:10px;font-size:13px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}
.tile-label{color:var(--ink2);font-size:12px}.tile-value{font-size:26px;font-weight:600;margin-top:2px}.tile-sub{color:var(--ink3);font-size:12px}
.meter{height:6px;border-radius:3px;background:var(--track);overflow:hidden;margin-top:8px}.meter span{display:block;height:100%;background:var(--accent);border-radius:3px}
.phases{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin-bottom:28px}
.phase{color:inherit;text-decoration:none;display:block}.phase:hover{border-color:var(--ink3)}
.phase-head{display:flex;gap:8px;align-items:baseline}.phase-id{color:var(--ink3);font-variant-numeric:tabular-nums;font-size:12px}.phase-name{font-weight:600}.phase-pct{margin-left:auto;font-variant-numeric:tabular-nums;color:var(--ink2)}
.phase-counts{color:var(--ink2);font-size:12px;margin-top:8px}.phase-counts b{color:var(--ink);font-weight:600}
.tag{white-space:nowrap;font-size:11px;color:var(--ink3);border:1px solid var(--line);border-radius:999px;padding:0 6px}
.filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 16px;position:sticky;top:0;background:var(--bg);padding:10px 0;z-index:1}
.filters button,.filters select{font:inherit;font-size:13px;color:var(--ink2);background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:4px 12px;cursor:pointer}
.filters button[aria-pressed=true]{color:var(--ink);border-color:var(--ink3)}
.phase-section{margin-bottom:28px}table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}
th{text-align:left;font-weight:500;font-size:12px;color:var(--ink3);padding:8px 12px;border-bottom:1px solid var(--line)}
td{padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}tr:last-child td{border-bottom:0}
td:first-child{width:128px;white-space:nowrap}td.area{width:120px;color:var(--ink2);font-size:13px}td:last-child{width:72px}
.title{font-weight:500}.note{color:var(--ink2);font-weight:400;font-size:13px;margin-top:2px}.asked{color:var(--accent);margin-right:6px}
.status{display:inline-flex;gap:6px;align-items:center;font-size:13px;color:var(--ink2)}.status i{font-style:normal;width:14px;text-align:center}
.s-done i{color:var(--good)}.s-doing i{color:var(--warn)}.s-blocked i{color:var(--crit)}.s-todo i{color:var(--ink3)}
.you{font-size:12px;font-weight:600;color:var(--ink);border:1px solid var(--ink3);border-radius:999px;padding:1px 8px}.agent{font-size:12px;color:var(--ink3)}
tr.hidden,section.hidden{display:none}
@media (max-width:640px){.hero{grid-template-columns:1fr}td.area,th:nth-child(3){display:none}}
</style>
</head>
<body>
<main>
<header><h1>${esc(r.title)}</h1><div class="meta">Updated ${esc(r.updated)} · generated from docs/launch/roadmap.json</div></header>
<div class="hero">
  <div class="card"><div class="hero-label">Launch readiness</div><div class="hero-value">${s.pct}%</div>
    <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.pct}" aria-label="Launch readiness"><span style="width:${s.pct}%"></span></div>
    <div class="hero-sub">${s.done} of ${s.total} launch items done · <b>${s.needsYou} need you</b></div></div>
  <div><p class="goal" style="margin-top:0">${esc(r.goal)}</p>
    <div class="tiles">
      ${tile('Accounts', m.accounts, `${m.newAccounts7d ?? 0} new in last 7 days`)}
      ${tile('Active (7d)', m.active7d, 'accounts that saved')}
      ${tile('Saves', m.saves, `${m.saves7d ?? 0} in last 7 days`)}
      ${tile('Paying', m.paying, 'active subscriptions')}
      ${r.asks ? tile('Your asks shipped', r.asks.live, `of ${r.asks.total} · ${r.asks.partial} partial · ${r.asks.notBuilt + r.asks.devOnly} not live`) : ''}
    </div>
    <p class="meta">Production as of ${esc(r.snapshot?.asOf)} · prod backend ${esc(rel.prodBackend)} · dev backend ${esc(rel.devBackend)} · extension ${esc(rel.extension)} · iOS ${esc(rel.ios)} · Android ${esc(rel.android)}</p>
  </div>
</div>
<div class="phases">${phaseRows}</div>
<div class="filters" role="toolbar" aria-label="Filter items">
  <button data-f="all" aria-pressed="true">All</button>
  <button data-f="you" aria-pressed="false">Needs you</button>
  <button data-f="open" aria-pressed="false">Not done</button>
  <button data-f="doing" aria-pressed="false">In progress</button>
  <button data-f="asked" aria-pressed="false">★ Asked, not built</button>
  <select aria-label="Area"><option value="">All areas</option>${areas.map((a) => `<option>${esc(a)}</option>`).join('')}</select>
</div>
${sections}
<p class="meta">★ = asked for by Pritam in a FoundKeep thread. Statuses: ✓ Done · ◐ In progress · ○ To do · ■ Blocked.</p>
</main>
<script>
const asked = new Set(${JSON.stringify(r.items.filter((i) => i.asked).map((i) => i.id))});
const rows = [...document.querySelectorAll('tbody tr')];
let f = 'all';
const area = document.querySelector('.filters select');
function apply() {
  for (const row of rows) {
    const d = row.dataset;
    const ok = (f === 'all' || (f === 'you' && d.owner === 'pritam' && d.status !== 'done') || (f === 'open' && d.status !== 'done') ||
      (f === 'doing' && d.status === 'doing') || (f === 'asked' && asked.has(d.id) && d.status !== 'done')) && (!area.value || d.area === area.value);
    row.classList.toggle('hidden', !ok);
  }
  for (const s of document.querySelectorAll('.phase-section')) s.classList.toggle('hidden', !s.querySelector('tbody tr:not(.hidden)'));
}
for (const b of document.querySelectorAll('.filters button')) b.addEventListener('click', () => {
  f = b.dataset.f;
  for (const o of document.querySelectorAll('.filters button')) o.setAttribute('aria-pressed', String(o === b));
  apply();
});
area.addEventListener('change', apply);
</script>
</body>
</html>
`;
}
