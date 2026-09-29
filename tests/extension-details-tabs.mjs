import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pollUntil } from './helpers/poll.mjs';
import { launch, signIn, extensionPage, fixture, localCaptures } from './helpers/dock-launch.mjs';

// Replaces the per-tab save-review drafts: the only per-tab state left is the
// tab's last save and the one-time grant its details card is opened with.
test('details grants are per tab: a card edits only the save it was opened for, in its own tab, and closing the tab drops it', { timeout: 40000 }, async t => {
  const { context, worker, origin } = await launch(t, { prefix: 'foundkeep-details-tabs-' });
  await signIn(context, worker);
  await fixture(context, origin + '/__tab-*', '<title>Tab fixture</title><p>Text</p>');
  const a = await context.newPage(); await a.goto(origin + '/__tab-a');
  const b = await context.newPage(); await b.goto(origin + '/__tab-b');
  const ext = await extensionPage(context, worker);
  const tabs = await ext.evaluate(async () => (await chrome.tabs.query({})).filter(tab => /__tab-[ab]$/.test(tab.url)).sort((x, y) => x.url.localeCompare(y.url)));
  const note = (tab, text) => ext.evaluate(({ tab, text }) => import('./dock-control.js').then(m => m.startCapture(tab, 'note', { trigger: 'dock', text, attachPage: false })), { tab, text });
  assert.equal((await note(tabs[0], 'Note from tab A')).ok, true);
  assert.equal((await note(tabs[1], 'Note from tab B')).ok, true);
  const grant = tabId => ext.evaluate(tabId => import('./capture-details.js').then(m => m.grantDetails(tabId)), tabId);
  const urlA = await grant(tabs[0].id), urlB = await grant(tabs[1].id);
  assert.match(urlA, /review\.html\?tab=\d+&grant=/);
  assert.notEqual(urlA, urlB);

  const frame = async (page, id, url) => {
    await page.evaluate(({ id, url }) => { const f = document.createElement('iframe'); f.id = id; f.src = url; document.body.append(f); }, { id, url });
    const card = page.frameLocator('#' + id);
    await card.locator('#detailsForm').waitFor();
    return card;
  };
  // Tab A's card, framed in tab A, loads tab A's save.
  const cardA = await frame(a, 'cardA', urlA);
  await cardA.locator('#detailsForm[data-ready="true"]').waitFor({ timeout: 8000 });
  assert.equal(await cardA.locator('#detailsNote').inputValue(), 'Note from tab A');
  // Tab B's card framed in tab A never loads anything.
  const wrong = await frame(a, 'cardWrong', urlB);
  let ready = false;
  try { await wrong.locator('#detailsForm[data-ready="true"]').waitFor({ timeout: 2500 }); ready = true; } catch { /* expected */ }
  assert.equal(ready, false, 'a card framed by another tab must never load that tab\'s save');

  // A newer save on tab A does not retarget the open card: it still edits
  // the save it was opened for.
  assert.equal((await note(tabs[0], 'A later note from tab A')).ok, true);
  await cardA.locator('#detailsNote').fill('Edited note from tab A');
  await cardA.locator('#detailsSave').click();
  await pollUntil(ext, async () => (await (await import('./db.js')).listCaptures()).some(c => c.noteText === 'Edited note from tab A'), null);
  const notes = (await localCaptures(ext)).map(c => c.noteText).sort();
  assert.deepEqual(notes, ['A later note from tab A', 'Edited note from tab A', 'Note from tab B']);

  // Closing tab A drops its last save and grant; tab B keeps its own.
  const stored = () => worker.evaluate(async () => {
    const all = await chrome.storage.session.get(['foundkeep-last-saves', 'foundkeep-details-grants']);
    return { saves: Object.keys(all['foundkeep-last-saves'] || {}).map(Number), grants: Object.keys(all['foundkeep-details-grants'] || {}).map(Number) };
  });
  assert.ok((await stored()).saves.includes(tabs[0].id));
  await a.close();
  await pollUntil(worker, async id => !Object.keys((await chrome.storage.session.get('foundkeep-last-saves'))['foundkeep-last-saves'] || {}).map(Number).includes(id), tabs[0].id);
  const after = await stored();
  assert.equal(after.grants.includes(tabs[0].id), false);
  assert.ok(after.saves.includes(tabs[1].id) && after.grants.includes(tabs[1].id));
});
