import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const mode = process.argv[2] || "all";
const groups = [
  {
    name: "extension",
    source: "apps/extension/assets/mark.svg",
    targets: [16, 32, 48, 128].map((size) => ({
      size,
      file: `apps/extension/icons/icon${size}.png`,
    })),
  },
  {
    name: "web",
    source: "apps/web/assets/mark.svg",
    targets: [
      { size: 512, file: "apps/web/assets/mark-512.png" },
      { size: 180, file: "apps/web/assets/apple-touch-icon.png" },
    ],
  },
].filter((group) => mode === "all" || mode === group.name);

if (!groups.length) throw new Error("Use extension, web, or all.");

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});

try {
  for (const group of groups) {
    const svg = await readFile(path.join(root, group.source));
    const source = `data:image/svg+xml;base64,${svg.toString("base64")}`;
    for (const target of group.targets) {
      const page = await browser.newPage({
        viewport: { width: target.size, height: target.size },
        deviceScaleFactor: 1,
      });
      await page.setContent(
        `<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}img{display:block;width:100%;height:100%}</style><img src="${source}" alt="">`,
      );
      await page.locator("img").evaluate((image) => image.decode());
      await page.screenshot({ path: path.join(root, target.file) });
      await page.close();
      console.log(`rendered ${target.file} (${target.size}x${target.size})`);
    }
  }
} finally {
  await browser.close();
}
