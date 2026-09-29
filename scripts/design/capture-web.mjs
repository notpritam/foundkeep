// Captures real screenshots of the signed-in FoundKeep web dashboard
// (apps/site) on dev.foundkeep.app for Pritam's Launchpad design review.
// Real browser, real login, real demo data — no mockups.
//
//   /usr/bin/node scripts/design/capture-web.mjs [--mobile] [--empty] [--all]
//
// Writes JPEGs to deploy/dist/design/web/ and a manifest.json alongside them.
// Credentials are read from ~/.local/share/foundkeep-dev-demo/state.json and
// never printed.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

const { chromium } = await import('playwright-core');

const BASE = 'https://dev.foundkeep.app';
const OUT = path.join('/home/pritam/personal/apps/foundkeep-design/deploy/dist/design/web');
const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = new Set(process.argv.slice(2));
const doMobile = args.has('--mobile') || args.has('--all');
const doEmpty = args.has('--empty') || args.has('--all');

async function demoAccount(which) {
  const file = path.join(homedir(), '.local/share/foundkeep-dev-demo/state.json');
  const state = JSON.parse(await readFile(file, 'utf8'));
  const account = state.accounts[which];
  return { email: account.email, password: account.password };
}

async function signIn(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  if (!(await page.locator('#email').isVisible().catch(() => false))) {
    await page.locator('#email-signin summary').click();
  }
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#auth-submit').click();
  await page.waitForURL('**/dashboard', { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  await sleep(500);
}

const manifest = { items: [], flows: [] };
let counter = 0;
async function shot(page, { name, state, description, usage, fullPage = false, clip = null }) {
  counter += 1;
  const file = path.join(OUT, `${String(counter).padStart(3, '0')}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 80, fullPage, ...(clip ? { clip } : {}) });
  manifest.items.push({
    kind: 'screen', name: `Web · ${name}`, state, variant: 'Current (dev.foundkeep.app)',
    description, ...(usage ? { usage } : {}), image: file,
  });
  console.log(`  shot: Web · ${name} (${state})`);
  return file;
}

async function settle(page, extra = 400) { await page.waitForLoadState('networkidle').catch(() => {}); await sleep(extra); }

const skipped = [];
async function step(label, fn) {
  try { await fn(); }
  catch (error) { skipped.push(`${label}: ${String(error?.message || error).split('\n')[0]}`); console.log(`  SKIP: ${label} — ${String(error?.message || error).split('\n')[0]}`); }
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  const curator = await demoAccount('curator');

  try {
    // -----------------------------------------------------------------
    // Signed-out: auth screens (desktop)
    // -----------------------------------------------------------------
    {
      const context = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
      if (!(await page.locator('#email').isVisible().catch(() => false))) await page.locator('#email-signin summary').click();
      await settle(page);
      await shot(page, { name: 'Auth — log in', state: 'Desktop 1280×800', description: 'The log in screen: OAuth buttons plus an email/password form.' });

      await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' });
      if (!(await page.locator('#email').isVisible().catch(() => false))) await page.locator('#email-signin summary').click();
      await settle(page);
      await shot(page, { name: 'Auth — sign up', state: 'Desktop 1280×800', description: 'The sign up screen for a new FoundKeep account.' });

      await page.goto(`${BASE}/recover`, { waitUntil: 'networkidle' });
      await settle(page);
      await shot(page, { name: 'Auth — recover', state: 'Desktop 1280×800', description: 'Account recovery using a saved recovery code.' });
      await context.close();
    }

    // -----------------------------------------------------------------
    // Signed-in as curator: library, detail, collections, agents, etc.
    // -----------------------------------------------------------------
    const context = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await signIn(page, curator.email, curator.password);

    await step('Library — grid (all)', async () => {
      await shot(page, { name: 'Library — grid (all)', state: 'Desktop 1280×800', description: 'The signed-in library: masonry grid of every saved capture, sidebar expanded.' });
    });

    // Type filters
    const types = [
      ['screenshot', 'Screenshot'], ['selection', 'Highlight'], ['bookmark', 'Bookmark'], ['image', 'Image'],
      ['video', 'Video'], ['audio', 'Audio'], ['document', 'Document'], ['file', 'File'], ['note', 'Note'], ['tweet', 'Tweet'],
    ];
    for (const [value, label] of types) {
      await step(`Library — type: ${label}`, async () => {
        await page.goto(`${BASE}/dashboard?type=${value}`, { waitUntil: 'networkidle' });
        await settle(page);
        await shot(page, { name: `Library — type: ${label}`, state: 'Desktop 1280×800', description: `Library filtered to the ${label} capture type.` });
      });
    }

    // Search results
    await step('Library — search results', async () => {
      await page.goto(`${BASE}/dashboard?q=agent`, { waitUntil: 'networkidle' });
      await settle(page);
      await shot(page, { name: 'Library — search results', state: 'Desktop 1280×800', description: 'Library filtered by the search box (query "agent").' });
    });

    // Archive view
    await step('Library — archive view', async () => {
      await page.goto(`${BASE}/dashboard?archived=true`, { waitUntil: 'networkidle' });
      await settle(page);
      await shot(page, { name: 'Library — archive view', state: 'Desktop 1280×800', description: 'The Archive: captures kept out of the main library but not deleted.' });
    });

    // Sidebar collapsed
    await step('Library — sidebar collapsed', async () => {
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
      await settle(page);
      await page.locator('#toggle-sidebar').click();
      await sleep(400);
      await shot(page, { name: 'Library — sidebar collapsed', state: 'Desktop 1280×800', description: 'The library sidebar collapsed to icons-only (rail mode).' });
      // In rail mode the chevron button is hidden; the logo button re-expands.
      await page.locator('#sidebar-logo').click();
      await sleep(400);
    });

    // Cmd+K search open
    await step('Library — Cmd+K search open', async () => {
      await page.keyboard.press('Meta+k');
      await sleep(500);
      if (!(await page.locator('#command-input').isVisible().catch(() => false))) {
        await page.keyboard.press('Control+k');
        await sleep(500);
      }
      await shot(page, { name: 'Library — Cmd+K search open', state: 'Desktop 1280×800', description: 'The global command palette opened with Cmd+K, showing recent finds and destinations.' });
      await page.keyboard.press('Escape');
      await sleep(300);
    });

    // -----------------------------------------------------------------
    // Save detail: bookmark / tweet / note / screenshot
    // -----------------------------------------------------------------
    async function openFirstCardOfType(type) {
      await page.goto(`${BASE}/dashboard?type=${type}`, { waitUntil: 'networkidle' });
      await settle(page);
      const card = page.locator('#capture-grid [data-capture-id]').first();
      const id = await card.getAttribute('data-capture-id').catch(() => null);
      if (!id) return null;
      await card.locator('.capture-open').click();
      await sleep(700);
      return id;
    }

    let bookmarkId = null, tweetId = null, noteId = null, screenshotId = null;
    await step('Save detail — bookmark', async () => {
      bookmarkId = await openFirstCardOfType('bookmark');
      if (!bookmarkId) throw new Error('no bookmark capture found');
      await shot(page, { name: 'Save detail — bookmark', state: 'Desktop 1280×800', description: 'A bookmark opened as an overlay from the library.' });
    });
    if (bookmarkId) await step('Save detail — full page reader', async () => {
      await page.locator('.expand-capture').click();
      await settle(page);
      await shot(page, { name: 'Save detail — full page reader', state: 'Desktop 1280×800', description: 'A saved bookmark expanded to the full-page reading view.' });
    });

    await step('Save detail — tweet', async () => {
      tweetId = await openFirstCardOfType('tweet');
      if (!tweetId) throw new Error('no tweet capture found');
      await shot(page, { name: 'Save detail — tweet', state: 'Desktop 1280×800', description: 'A saved X/Twitter post with its preserved media, shown in the detail overlay.' });
    });

    await step('Save detail — note + archive/restore', async () => {
      noteId = await openFirstCardOfType('note');
      if (!noteId) throw new Error('no note capture found');
      const archived = await page.locator('#archive-capture').innerText().catch(() => '');
      await shot(page, { name: 'Save detail — note', state: 'Desktop 1280×800', description: 'A personal note opened in the detail overlay, with archive/delete actions.' });
      if (!/archive/i.test(archived)) return;
      let archivedNow = false;
      try {
        await page.locator('#archive-capture').click();
        await sleep(700);
        archivedNow = true;
        await page.goto(`${BASE}/dashboard?archived=true`, { waitUntil: 'networkidle' });
        await settle(page);
        const card = page.locator('#capture-grid [data-capture-id]').first();
        if (await card.count()) {
          await card.locator('.capture-open').click();
          await sleep(700);
          await shot(page, { name: 'Save detail — restore action', state: 'Desktop 1280×800', description: 'An archived note opened from the Archive, showing the Restore save action.' });
        }
      } finally {
        // Always put the demo note back the way it was found, even if a shot above failed.
        if (archivedNow) {
          await page.goto(`${BASE}/dashboard?archived=true&item=${encodeURIComponent(noteId)}`, { waitUntil: 'networkidle' }).catch(() => {});
          await sleep(500);
          await page.locator('#archive-capture').click().catch(() => {});
          await sleep(500);
        }
      }
    });

    await step('Save detail — screenshot', async () => {
      screenshotId = await openFirstCardOfType('screenshot');
      if (!screenshotId) throw new Error('no screenshot capture found');
      await shot(page, { name: 'Save detail — screenshot', state: 'Desktop 1280×800', description: 'A screenshot capture opened in the detail overlay.' });
    });

    // -----------------------------------------------------------------
    // Collections
    // -----------------------------------------------------------------
    await step('Collections — my collections', async () => {
      await page.goto(`${BASE}/dashboard/collections`, { waitUntil: 'networkidle' });
      await settle(page);
      await shot(page, { name: 'Collections — my collections', state: 'Desktop 1280×800', description: 'The signed-in "Your collections" list: owned, joined and followed collections.' });
    });

    await step('Collections — create collection', async () => {
      await page.locator('.collection-toolbar .button.primary').click();
      await sleep(400);
      await shot(page, { name: 'Collections — create collection', state: 'Desktop 1280×800', description: 'The inline "New collection" form opened from the collections list.' });
      await page.goto(`${BASE}/dashboard/collections`, { waitUntil: 'networkidle' });
    });

    let firstCollectionId = null;
    await step('Collections — collection page (owner) + moderation', async () => {
      firstCollectionId = await page.evaluate(() => {
        const link = document.querySelector('a[href^="/dashboard/collections/"]');
        return link ? link.getAttribute('href').split('/').pop() : null;
      });
      if (!firstCollectionId) throw new Error('no owned collection found');
      await page.goto(`${BASE}/dashboard/collections/${firstCollectionId}`, { waitUntil: 'networkidle' });
      await settle(page);
      await shot(page, { name: 'Collections — collection page (owner)', state: 'Desktop 1280×800', description: 'A collection opened from the owner side: finds, tabs for add/settings/moderation.' });

      const hasPending = await page.locator('[data-value="pending"], button:has-text("Approval queue")').first().isVisible().catch(() => false);
      if (hasPending) {
        await page.goto(`${BASE}/dashboard/collections/${firstCollectionId}?tab=pending`, { waitUntil: 'networkidle' });
        await settle(page);
        await shot(page, { name: 'Collections — moderation queue', state: 'Desktop 1280×800', description: 'The approval queue for a collection that requires curator approval before a suggestion appears.' });
      }
    });

    await step('Collections — explore/discover', async () => {
      await page.goto(`${BASE}/collections`, { waitUntil: 'networkidle' });
      await settle(page);
      await shot(page, { name: 'Collections — explore/discover', state: 'Desktop 1280×800', description: 'The public collections directory, searchable and browsable by anyone.' });
    });

    await step('Collections — public collection page', async () => {
      await page.goto(`${BASE}/collection/demo-agent-toolkit`, { waitUntil: 'networkidle' });
      await settle(page);
      await shot(page, { name: 'Collections — public collection page', state: 'Desktop 1280×800', description: 'A public collection page as any visitor sees it.' });
    });

    // -----------------------------------------------------------------
    // Mind map, agents, apps & devices, plans, settings, support, connect
    // -----------------------------------------------------------------
    await step('Mind map', async () => {
      await page.goto(`${BASE}/dashboard/mind-map`, { waitUntil: 'networkidle' });
      await settle(page, 1200);
      await shot(page, { name: 'Mind map', state: 'Desktop 1280×800', description: 'The mind map / graph view of saved items and tags.' });
    });

    await step('Agents', async () => {
      await page.goto(`${BASE}/dashboard/agents`, { waitUntil: 'networkidle' });
      await settle(page);
      await shot(page, { name: 'Agents', state: 'Desktop 1280×800', description: 'The Agents page: connected agent integrations for the signed-in account.' });
    });

    await step('Agents — connect agent (landing)', async () => {
      await page.goto(`${BASE}/connect`, { waitUntil: 'networkidle' });
      await settle(page);
      await shot(page, { name: 'Agents — connect agent (landing)', state: 'Desktop 1280×800', description: 'The public "Connect FoundKeep to Claude & Codex" landing page.' });
    });

    await step('Apps & devices', async () => {
      await page.goto(`${BASE}/dashboard/apps`, { waitUntil: 'networkidle' });
      await settle(page);
      await shot(page, { name: 'Apps & devices', state: 'Desktop 1280×800', description: 'Connected browsers, mobile apps and device pairings.' });
    });

    await step('Plans & usage', async () => {
      await page.goto(`${BASE}/dashboard/plans`, { waitUntil: 'networkidle' });
      await settle(page);
      await shot(page, { name: 'Plans & usage', state: 'Desktop 1280×800', description: 'Plan details and usage against the account’s limits.' });
    });

    await step('Settings — account', async () => {
      await page.goto(`${BASE}/dashboard/settings`, { waitUntil: 'networkidle' });
      await settle(page);
      await shot(page, { name: 'Settings — account', state: 'Desktop 1280×800', description: 'Settings: account identity, appearance, password/recovery and account actions.' });
    });

    await step('Settings — capture', async () => {
      await page.goto(`${BASE}/dashboard/settings/capture`, { waitUntil: 'networkidle' });
      await settle(page);
      await shot(page, { name: 'Settings — capture', state: 'Desktop 1280×800', description: 'Settings: browser capture preferences for every connected extension.' });
    });

    await step('Settings — processing', async () => {
      await page.goto(`${BASE}/dashboard/settings/processing`, { waitUntil: 'networkidle' });
      await settle(page);
      await shot(page, { name: 'Settings — processing', state: 'Desktop 1280×800', description: 'Settings: managed processing (automatic tagging/summaries) controls and usage.' });
    });

    await step('Support', async () => {
      await page.goto(`${BASE}/support`, { waitUntil: 'networkidle' });
      await settle(page);
      await shot(page, { name: 'Support', state: 'Desktop 1280×800', description: 'The Support page.' });
    });

    // -----------------------------------------------------------------
    // Mobile viewport: library, detail, navigation
    // -----------------------------------------------------------------
    if (doMobile) await step('Mobile — library/nav/detail', async () => {
      const mcontext = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const mpage = await mcontext.newPage();
      try {
        await signIn(mpage, curator.email, curator.password);
        await settle(mpage);
        await shot(mpage, { name: 'Library — grid (all)', state: 'Mobile 390×844', description: 'The library grid on a small viewport.' });

        await mpage.locator('#open-sidebar').click();
        await sleep(400);
        await shot(mpage, { name: 'Library — navigation (mobile drawer)', state: 'Mobile 390×844', description: 'The mobile navigation drawer opened over the library.' });
        await mpage.keyboard.press('Escape');
        await sleep(300);

        const card = mpage.locator('#capture-grid [data-capture-id]').first();
        if (await card.count()) {
          await card.locator('.capture-open').click();
          await sleep(700);
          await shot(mpage, { name: 'Save detail — overlay', state: 'Mobile 390×844', description: 'A capture opened in the detail overlay on a small viewport.' });
        }
      } finally { await mcontext.close(); }
    });

    await context.close();

    // -----------------------------------------------------------------
    // Empty state: disposable dev account
    // -----------------------------------------------------------------
    if (doEmpty) await step('Library — empty (first run) + cleanup', async () => {
      const econtext = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1 });
      const epage = await econtext.newPage();
      try {
        const email = `fk-design-empty-${Date.now()}@dev.foundkeep.invalid`;
        const password = 'Design-Capture-Temp-2026!';
        await epage.goto(`${BASE}/signup`, { waitUntil: 'networkidle' });
        if (!(await epage.locator('#email').isVisible().catch(() => false))) await epage.locator('#email-signin summary').click();
        await epage.locator('#name').fill('Design Capture');
        await epage.locator('#email').fill(email);
        await epage.locator('#password').fill(password);
        await epage.locator('#auth-submit').click();
        await epage.waitForSelector('#recovery-saved', { timeout: 20000 });
        await epage.locator('#recovery-saved').check();
        await epage.locator('#continue-dashboard').click();
        await epage.waitForURL('**/dashboard', { timeout: 20000 });
        await settle(epage);
        await shot(epage, { name: 'Library — empty (first run)', state: 'Desktop 1280×800', description: 'A brand-new account’s library before any save exists.' });

        // Clean up: delete the disposable account.
        await epage.goto(`${BASE}/dashboard/settings`, { waitUntil: 'networkidle' });
        await epage.locator('#open-delete-account').click();
        await sleep(300);
        await epage.locator('#delete-password').fill(password);
        await epage.locator('#delete-acknowledged').check();
        await epage.locator('#delete-account-submit').click();
        await epage.waitForURL('**/signup*', { timeout: 20000 }).catch(() => {});
      } finally { await econtext.close(); }
    });
  } finally {
    await browser.close();
  }

  // -----------------------------------------------------------------
  // Flows
  // -----------------------------------------------------------------
  const has = (name) => manifest.items.some((i) => i.name === `Web · ${name}`);
  if (doEmpty && has('Library — empty (first run)') && has('Auth — sign up')) {
    manifest.flows.push({
      name: 'Web · First run', scenarios: [{ id: 'first-run', name: 'Sign up to first save', steps: [
        'Web · Auth — sign up', 'Web · Library — empty (first run)', 'Web · Library — grid (all)',
      ] }],
    });
  }
  if (has('Library — grid (all)') && has('Save detail — bookmark') && has('Collections — my collections')) {
    manifest.flows.push({
      name: 'Web · Organize', scenarios: [{ id: 'organize', name: 'Library to collection', steps: [
        'Web · Library — grid (all)', 'Web · Save detail — bookmark', 'Web · Save detail — full page reader',
        'Web · Collections — my collections', 'Web · Collections — collection page (owner)',
      ] }],
    });
  }

  const manifestPath = path.join(OUT, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nWrote ${manifest.items.length} items, ${manifest.flows.length} flows -> ${manifestPath}`);
  if (skipped.length) console.log(`Skipped (${skipped.length}):\n  ${skipped.join('\n  ')}`);
}

await run();
