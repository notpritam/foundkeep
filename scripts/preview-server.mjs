// Review server: serves only public site/extension assets, with an isolated demo shim.
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.ATLAS_PREVIEW_PORT || 9048);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".zip": "application/zip",
};
http
  .createServer(async (req, res) => {
    try {
      let url = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (url === "/") url = "/apps/web/";
      if (url.endsWith("/")) url += "index.html";
      if (url === "/__preview/runtime.js") url = "/scripts/preview/runtime.js";
      if (
        !url.startsWith("/apps/web/") &&
        !url.startsWith("/apps/extension/") &&
        url !== "/scripts/preview/runtime.js"
      )
        throw new Error("Not found");
      const file = path.resolve(root, "." + url);
      if (
        !file.startsWith(root + path.sep) ||
        url.split("/").some((s) => s.startsWith("."))
      )
        throw new Error("Not found");
      let body = await readFile(file);
      if (
        url === "/apps/extension/src/popup.html" ||
        url === "/apps/extension/src/dashboard.html"
      ) {
        body = body
          .toString()
          .replace(
            /<script type="module" src="(popup|dashboard)\.js"><\/script>/,
            (_, entry) =>
              `<script type="module">import {ready} from '/__preview/runtime.js'; await ready; await import('./${entry}.js');</script>`,
          );
      }
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  })
  .listen(port, "0.0.0.0", () =>
    console.log(`Atlas review preview listening on ${port}`),
  );
