import { chromium } from "playwright-core";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(".");
const output = path.join(root, "deploy/dist/store-assets");
await mkdir(output, { recursive: true });

async function dataUrl(file, mime) {
  return `data:${mime};base64,${(await readFile(file)).toString("base64")}`;
}

const [mark, popup, displayFont, bodyFont] = await Promise.all([
  dataUrl(path.join(root, "apps/web/assets/studio-mark.svg"), "image/svg+xml"),
  dataUrl(path.join(root, "apps/web/assets/extension-popup.png"), "image/png"),
  dataUrl(path.join(root, "apps/web/assets/fonts/ClarityCity-SemiBold.woff2"), "font/woff2"),
  dataUrl(path.join(root, "apps/web/assets/fonts/geist-latin.woff2"), "font/woff2"),
]);

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ deviceScaleFactor: 1 });

const base = `
  <style>
    @font-face { font-family: Clarity; src: url(${displayFont}) format("woff2"); font-weight: 600; }
    @font-face { font-family: Geist; src: url(${bodyFont}) format("woff2"); font-weight: 100 900; }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
    body { font-family: Geist, sans-serif; background: #121411; color: #f3f3f0; }
    h1, h2, p { margin: 0; }
    h1, h2 { font-family: Clarity, sans-serif; letter-spacing: -0.045em; }
  </style>`;

async function render({ width, height, name, html }) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html>${base}${html}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(output, name) });
}

await render({
  width: 1280,
  height: 800,
  name: "extension-popup.png",
  html: `<main style="position:relative;width:100%;height:100%;display:grid;grid-template-columns:1fr 480px;align-items:center;gap:70px;padding:66px 96px;background:radial-gradient(circle at 92% 12%,#3a2119 0,transparent 31%),#121411">
    <section style="max-width:620px;align-self:center">
      <div style="display:flex;align-items:center;gap:13px;margin-bottom:64px"><img src="${mark}" width="48" height="48" alt=""><strong style="font:600 25px Clarity">Foundkeep</strong></div>
      <p style="margin-bottom:20px;color:#dd6a4f;font:600 13px Geist;letter-spacing:.18em">FOUNDKEEP FOR CHROME</p>
      <h1 style="font-size:68px;line-height:.98;max-width:590px">Save it with the source intact.</h1>
      <p style="margin-top:30px;max-width:520px;color:#bfc1b9;font-size:20px;line-height:1.55">Readable pages, highlights, screenshots, images and notes—kept locally first, with private account sync when you want it.</p>
      <div style="display:flex;gap:28px;margin-top:46px;color:#e9e9e4;font-size:15px"><span>Readable copy</span><span style="color:#777b72">•</span><span>Traceable origin</span><span style="color:#777b72">•</span><span>Your controls</span></div>
    </section>
    <section style="justify-self:end;position:relative;width:444px;height:684px;border:1px solid #3e413b;background:#f3f3f0;box-shadow:0 36px 90px rgba(0,0,0,.46)">
      <div style="height:52px;display:flex;align-items:center;gap:8px;padding:0 18px;border-bottom:1px solid #d3d5cf;background:#e8e9e4"><i style="width:10px;height:10px;border-radius:50%;background:#c63b23"></i><i style="width:10px;height:10px;border-radius:50%;background:#d6aa5c"></i><i style="width:10px;height:10px;border-radius:50%;background:#568f6b"></i><span style="margin-left:20px;width:258px;padding:7px 14px;border:1px solid #ccd0c8;border-radius:7px;background:#f7f7f4;color:#686c64;font-size:11px">example.com/article</span></div>
      <img src="${popup}" alt="Foundkeep extension popup" style="display:block;width:390px;height:600px;margin:16px auto 0;box-shadow:0 10px 30px rgba(27,29,25,.15)">
    </section>
    <div style="position:absolute;left:0;bottom:0;width:12px;height:200px;background:#c63b23"></div>
  </main>`,
});

await render({
  width: 440,
  height: 280,
  name: "promo-small.png",
  html: `<main style="position:relative;width:100%;height:100%;padding:36px 38px;background:#c63b23;color:#fff7f1">
    <div style="display:flex;align-items:center;gap:12px"><img src="${mark}" width="46" height="46" alt=""><strong style="font:600 24px Clarity">Foundkeep</strong></div>
    <h1 style="margin-top:44px;max-width:330px;font-size:40px;line-height:1">Keep the good things.</h1>
    <div style="position:absolute;right:25px;bottom:22px;width:84px;height:92px;border:1px solid rgba(255,255,255,.36);background:#161816;clip-path:polygon(0 0,100% 0,100% 100%,50% 70%,0 100%)"></div>
    <div style="position:absolute;right:46px;bottom:66px;width:11px;height:11px;border-radius:50%;background:#c63b23"></div>
  </main>`,
});

await render({
  width: 1400,
  height: 560,
  name: "promo-marquee.png",
  html: `<main style="position:relative;width:100%;height:100%;display:grid;grid-template-columns:1fr 570px;align-items:center;gap:70px;padding:60px 90px;background:linear-gradient(110deg,#121411 0 66%,#1c1f1a 66%)">
    <section><div style="display:flex;align-items:center;gap:14px;margin-bottom:48px"><img src="${mark}" width="52" height="52" alt=""><strong style="font:600 28px Clarity">Foundkeep</strong></div><h1 style="max-width:690px;font-size:72px;line-height:.97">A place for what’s worth keeping.</h1><p style="margin-top:24px;color:#b9bcb3;font-size:20px">Capture the useful part. Return to the original source.</p></section>
    <section style="display:grid;grid-template-columns:1fr 1fr;gap:14px;transform:rotate(-2deg)">
      <article style="grid-column:1/-1;padding:26px 28px;border:1px solid #454941;background:#20231e"><small style="color:#dd6a4f;letter-spacing:.13em">READABLE PAGE</small><h2 style="margin-top:22px;font-size:30px">The meaning of a quiet space</h2><p style="margin-top:14px;color:#aeb2a8">fieldnotes.example · source saved</p></article>
      <article style="padding:24px;border:1px solid #454941;background:#191b18"><small style="color:#dd6a4f;letter-spacing:.13em">HIGHLIGHT</small><h2 style="margin-top:20px;font-size:22px;line-height:1.1">Design makes information easier to find.</h2></article>
      <article style="padding:24px;border:1px solid #504b3f;background:#29291f"><small style="color:#dd6a4f;letter-spacing:.13em">NOTE</small><h2 style="margin-top:20px;font-size:22px;line-height:1.1">Remember the copper door.</h2></article>
    </section>
    <div style="position:absolute;left:0;bottom:0;width:220px;height:10px;background:#c63b23"></div>
  </main>`,
});

await browser.close();
console.log(`Rendered Chrome Web Store assets in ${output}`);
