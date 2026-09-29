#!/usr/bin/env /usr/bin/node
// Captures the public, signed-out FoundKeep "Site" surface — foundkeep.app
// (marketing site) and help.foundkeep.app / blog.foundkeep.app — for
// Pritam's Launchpad design workspace. Read-only: never signs up, saves, or
// changes settings on production.
//
// Usage:
//   /usr/bin/node scripts/design/capture-site.mjs [home|pages|help|all]
// Defaults to "all". Re-run any time; images are overwritten in place and
// the publisher (run separately) dedupes unchanged content.
//
// Output: deploy/dist/design/site/*.jpg + deploy/dist/design/site/manifest.json

import { chromium } from '/home/pritam/personal/apps/foundkeep-scenic-landing/node_modules/playwright-core/index.mjs';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = '/home/pritam/personal/apps/foundkeep-design/deploy/dist/design/site';
mkdirSync(OUT_DIR, { recursive: true });

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };
const VARIANT = 'Current (production)';

const items = [];

function addItem({ name, mobile, description, file }) {
  items.push({
    kind: 'screen',
    name,
    state: mobile ? 'Mobile 390×844' : 'Desktop 1280×800',
    variant: VARIANT,
    description,
    image: join(OUT_DIR, file),
  });
}

async function shrinkIfNeeded(path, page, opts) {
  // Keep files under ~1.2MB per common.md; re-shoot at lower quality if needed.
  let size = statSync(path).size;
  let quality = 80;
  while (size > 1_200_000 && quality > 35) {
    quality -= 15;
    await page.screenshot({ ...opts, path, quality });
    size = statSync(path).size;
  }
}

async function fullPage(page, file) {
  const path = join(OUT_DIR, file);
  await page.screenshot({ path, type: 'jpeg', quality: 80, fullPage: true });
  await shrinkIfNeeded(path, page, { type: 'jpeg', fullPage: true });
  return file;
}

async function viewportShot(page, file) {
  const path = join(OUT_DIR, file);
  await page.screenshot({ path, type: 'jpeg', quality: 80, fullPage: false });
  await shrinkIfNeeded(path, page, { type: 'jpeg', fullPage: false });
  return file;
}

async function sectionShot(page, selector, file) {
  const path = join(OUT_DIR, file);
  await page.locator(selector).screenshot({ path, type: 'jpeg', quality: 80 });
  return file;
}

async function newPage(browser, { mobile } = {}) {
  const page = await browser.newPage({ viewport: mobile ? MOBILE : DESKTOP, deviceScaleFactor: 1 });
  return page;
}

async function goto(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(200); // let webfonts/animations settle
}

// ---------------------------------------------------------------------------
// foundkeep.app home page: full page + one shot per section.
// ---------------------------------------------------------------------------
async function captureHome(browser, mobile) {
  const suffix = mobile ? ' (mobile)' : '';
  const tag = mobile ? '-mobile' : '-desktop';
  const page = await newPage(browser, { mobile });
  await goto(page, 'https://foundkeep.app/');

  addItem({
    name: 'Site · Home — first view',
    mobile,
    description: 'foundkeep.app landing page, above the fold.',
    file: await viewportShot(page, `home-first-view${tag}.jpg`),
  });
  addItem({
    name: `Site · Home — full page${suffix}`,
    mobile,
    description: 'foundkeep.app landing page, entire scroll.',
    file: await fullPage(page, `home-full${tag}.jpg`),
  });
  addItem({
    name: `Site · Home — capture${suffix}`,
    mobile,
    description: 'Interactive "save it" demo section on the home page.',
    file: await sectionShot(page, '#capture', `home-capture${tag}.jpg`),
  });
  addItem({
    name: `Site · Home — library${suffix}`,
    mobile,
    description: '"All your curiosities" library feature section.',
    file: await sectionShot(page, '#library', `home-library${tag}.jpg`),
  });
  addItem({
    name: `Site · Home — everywhere${suffix}`,
    mobile,
    description: 'Cross-device "wherever you find it" feature section.',
    file: await sectionShot(page, '#everywhere', `home-everywhere${tag}.jpg`),
  });
  addItem({
    name: `Site · Home — how it works${suffix}`,
    mobile,
    description: 'Getting-started steps, including the Add to Chrome install CTA.',
    file: await sectionShot(page, '#how', `home-how${tag}.jpg`),
  });
  addItem({
    name: `Site · Home — pricing${suffix}`,
    mobile,
    description: 'Pricing section on the home page (there is no standalone /pricing route).',
    file: await sectionShot(page, '#pricing', `home-pricing${tag}.jpg`),
  });

  await page.locator('section:has(#faq-heading) summary').first().click();
  await page.waitForTimeout(150);
  addItem({
    name: `Site · Home — faq expanded${suffix}`,
    mobile,
    description: 'FAQ section with the first question expanded.',
    file: await sectionShot(page, 'section:has(#faq-heading)', `home-faq${tag}.jpg`),
  });

  addItem({
    name: `Site · Home — footer${suffix}`,
    mobile,
    description: 'Site footer: brand, copyright and secondary nav links.',
    file: await sectionShot(page, 'footer', `home-footer${tag}.jpg`),
  });

  if (mobile) {
    await page.locator('.menu-toggle').click();
    await page.waitForTimeout(200);
    addItem({
      name: 'Site · Header — mobile menu open',
      mobile,
      description: 'Mobile nav opened from the header hamburger toggle.',
      file: await viewportShot(page, `header-mobile-menu-open.jpg`),
    });
  }

  await page.close();
}

// ---------------------------------------------------------------------------
// Other top-level public foundkeep.app pages.
// ---------------------------------------------------------------------------
const TOP_LEVEL_PAGES = [
  { name: 'Site · Beta', url: 'https://foundkeep.app/beta', description: 'Beta access page: browser extension, iOS TestFlight and Android APK install links.' },
  { name: 'Site · Support', url: 'https://foundkeep.app/support', description: 'Support page.' },
  { name: 'Site · Privacy', url: 'https://foundkeep.app/privacy', description: 'Privacy policy page.' },
  { name: 'Site · Terms', url: 'https://foundkeep.app/terms', description: 'Terms of service page.' },
  { name: 'Site · Login', url: 'https://foundkeep.app/login', description: 'Signed-out login page (screenshot only — never submitted).' },
  { name: 'Site · Signup', url: 'https://foundkeep.app/signup', description: 'Signed-out signup page (screenshot only — never submitted).' },
  { name: 'Site · Explore collections', url: 'https://foundkeep.app/collections', description: 'Public collections explore page, linked from the header nav.' },
  { name: 'Site · 404', url: 'https://foundkeep.app/this-page-does-not-exist-xyz', description: 'Not-found page.' },
];

async function capturePages(browser, mobile) {
  const suffix = mobile ? ' (mobile)' : '';
  const tag = mobile ? '-mobile' : '-desktop';
  const page = await newPage(browser, { mobile });
  for (const spec of TOP_LEVEL_PAGES) {
    await goto(page, spec.url);
    const slug = spec.name.replace('Site · ', '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    addItem({
      name: `${spec.name}${suffix}`,
      mobile,
      description: spec.description,
      file: await fullPage(page, `page-${slug}${tag}.jpg`),
    });
  }
  await page.close();
}

// ---------------------------------------------------------------------------
// help.foundkeep.app + blog.foundkeep.app
// ---------------------------------------------------------------------------
const HELP_PAGES = [
  { name: 'Help · Home', url: 'https://help.foundkeep.app/', description: 'Help center home (Astro Starlight splash page).' },
  { name: 'Help · Getting started', url: 'https://help.foundkeep.app/getting-started/', description: 'Getting-started article.' },
  { name: 'Help · Use case — research library', url: 'https://help.foundkeep.app/usecase-research-library/', description: 'One "pick a use case" article.' },
  { name: 'Help · Blog — index', url: 'https://help.foundkeep.app/blog/', description: 'FoundKeep blog index.' },
  { name: 'Help · Blog — post', url: 'https://help.foundkeep.app/blog/let-an-ai-agent-run-your-library/', description: 'A single blog post.' },
];

async function captureHelp(browser, mobile) {
  const suffix = mobile ? ' (mobile)' : '';
  const tag = mobile ? '-mobile' : '-desktop';
  const page = await newPage(browser, { mobile });
  for (const spec of HELP_PAGES) {
    await goto(page, spec.url);
    const slug = spec.name.replace('Help · ', '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    addItem({
      name: `${spec.name}${suffix}`,
      mobile,
      description: spec.description,
      file: await fullPage(page, `help-${slug}${tag}.jpg`),
    });
  }

  // Search dialog, opened from the help home page header.
  await goto(page, 'https://help.foundkeep.app/');
  await page.locator('button[data-open-modal]').click();
  await page.waitForTimeout(250);
  addItem({
    name: `Help · Search open${suffix}`,
    mobile,
    description: 'Pagefind search dialog opened from the header search button.',
    file: await viewportShot(page, `help-search-open${tag}.jpg`),
  });

  if (mobile) {
    // Sidebar-toggle ("Menu") only exists on doc pages with a sidebar, not the splash home.
    await goto(page, 'https://help.foundkeep.app/getting-started/');
    await page.locator('.sl-menu-button').click();
    await page.waitForTimeout(250);
    addItem({
      name: 'Help · Mobile menu open',
      mobile,
      description: 'Starlight sidebar nav opened via the mobile "Menu" toggle on a doc page.',
      file: await viewportShot(page, `help-mobile-menu-open.jpg`),
    });
  }

  await page.close();
}

const FLOWS = [
  {
    name: 'Site · Visitor journey',
    scenarios: [
      { id: 'visitor', name: 'Home → pricing → sign up', steps: ['Site · Home — first view', 'Site · Home — pricing', 'Site · Signup'] },
    ],
  },
  {
    name: 'Site · Help',
    scenarios: [
      { id: 'help', name: 'Help home → article → blog post', steps: ['Help · Home', 'Help · Getting started', 'Help · Blog — post'] },
    ],
  },
];

async function main() {
  const which = process.argv[2] || 'all';
  const browser = await chromium.launch({ channel: 'chromium' });
  try {
    if (which === 'home' || which === 'all') {
      await captureHome(browser, false);
      await captureHome(browser, true);
    }
    if (which === 'pages' || which === 'all') {
      await capturePages(browser, false);
      await capturePages(browser, true);
    }
    if (which === 'help' || which === 'all') {
      await captureHelp(browser, false);
      await captureHelp(browser, true);
    }
  } finally {
    await browser.close();
  }

  const manifest = { items, ...(which === 'all' ? { flows: FLOWS } : {}) };
  const manifestPath = join(OUT_DIR, `manifest${which === 'all' ? '' : `-${which}`}.json`);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  console.log(`Wrote ${items.length} items to ${manifestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
