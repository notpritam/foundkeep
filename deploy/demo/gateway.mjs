#!/usr/bin/env node
// The live demo's front door (:8818, public through bb Connect). It serves the
// app's web build under /app/ and proxies everything else to the demo
// dashboard (:8819), which forwards /api to the demo backend (:8817). The app
// and the dashboard therefore share one origin and one throwaway backend.
// Only this demo may be framed, and only by the design system's Storybook.
import { createServer, request as forward } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.DEMO_GATEWAY_PORT || 8818);
const SITE = new URL(process.env.DEMO_SITE_URL || 'http://127.0.0.1:8819');
const APP_DIR = path.resolve(process.env.DEMO_APP_DIR || path.join(homedir(), '.local/share/foundkeep-demo/app/current'));
const FRAMERS = process.env.DEMO_FRAME_ANCESTORS || 'https://omni--8814.getbb.app http://127.0.0.1:8814';
const FRAME_POLICY = `frame-ancestors ${FRAMERS}`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

// The app's web build calls its production origin; in the demo those requests
// go to this origin instead, so they reach the demo backend.
const REWRITE = `<script>(()=>{const from=['https://dev.foundkeep.app','https://foundkeep.app'];
const all=v=>{if(typeof v!=='string')return v;for(const f of from)v=v.split(f+'/').join(location.origin+'/');return v};
const one=u=>typeof u==='string'||u instanceof URL?all(String(u)):u;
const f=window.fetch.bind(window);window.fetch=(i,o)=>f(i instanceof Request?new Request(all(i.url),i):one(i),o);
const x=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u,...r){return x.call(this,m,one(u),...r)};
const patch=(proto,prop)=>{const d=Object.getOwnPropertyDescriptor(proto,prop);if(d&&d.set)Object.defineProperty(proto,prop,{...d,set(v){d.set.call(this,all(v))}})};
patch(HTMLImageElement.prototype,'src');patch(HTMLImageElement.prototype,'srcset');patch(HTMLSourceElement.prototype,'src');patch(HTMLMediaElement.prototype,'src');
for(const proto of new Set([CSSStyleDeclaration.prototype,Object.getPrototypeOf(document.documentElement.style)]))for(const p of ['backgroundImage','background','cssText'])patch(proto,p);
const sp=CSSStyleDeclaration.prototype.setProperty;CSSStyleDeclaration.prototype.setProperty=function(n,v,q){return sp.call(this,n,all(v),q)};
const sa=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){return sa.call(this,n,all(v))};
const ir=CSSStyleSheet.prototype.insertRule;CSSStyleSheet.prototype.insertRule=function(r,i){return ir.call(this,all(r),i)};
const rs=CSSStyleSheet.prototype.replaceSync;CSSStyleSheet.prototype.replaceSync=function(t){return rs.call(this,all(t))};
const fixStyle=e=>{const v=e.getAttribute&&e.getAttribute('style');if(v&&v.includes('foundkeep.app/'))e.setAttribute('style',all(v))};
new MutationObserver(list=>{for(const m of list){if(m.type==='attributes')fixStyle(m.target);else for(const n of m.addedNodes)if(n.nodeType===1){fixStyle(n);n.querySelectorAll('[style*="foundkeep.app/"]').forEach(fixStyle)}}}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style']});})();</script>`;

function frameHeaders(headers) {
  delete headers['x-frame-options'];
  const csp = headers['content-security-policy'];
  headers['content-security-policy'] = csp ? String(csp).replace(/frame-ancestors[^;]*;?/i, '').trim().replace(/;?$/, '; ') + FRAME_POLICY : FRAME_POLICY;
  return headers;
}

async function serveApp(req, res, pathname) {
  const relative = decodeURIComponent(pathname.replace(/^\/app\/?/, ''));
  let file = path.resolve(APP_DIR, relative || 'index.html');
  if (!file.startsWith(APP_DIR + path.sep) && file !== APP_DIR) { res.writeHead(403).end(); return; }
  const found = await stat(file).catch(() => null);
  if (!found?.isFile()) file = path.join(APP_DIR, 'index.html');
  let body = await readFile(file);
  const type = TYPES[path.extname(file)] || 'application/octet-stream';
  if (file.endsWith('index.html')) body = Buffer.from(body.toString('utf8').replace('<head>', '<head>' + REWRITE));
  // The browser itself refuses anything aimed at another origin (production
  // included): the rewrite above catches most URLs, this catches the rest
  // (e.g. inline background images) before a request leaves the page.
  const headers = frameHeaders({ 'content-type': type, 'cache-control': file.endsWith('.html') ? 'no-store' : 'public, max-age=3600' });
  if (file.endsWith('.html')) headers['content-security-policy'] = `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:; connect-src 'self'; ${FRAME_POLICY}`;
  res.writeHead(200, headers);
  res.end(body);
}

// An <img> cannot send the app's bearer token, so the gateway signs private
// image requests in as the demo account. The instance only holds sample data.
const STATE = path.join(homedir(), '.local/share/foundkeep-demo/state.json');
const IMAGE = /^\/api\/mobile\/captures\/[^/]+\/(blob|preview|file|assets\/[^/?]+)(\?|$)/;
let demoToken = null;
async function signIn() {
  const { email, password } = JSON.parse(await readFile(STATE, 'utf8'));
  const response = await fetch(`${SITE.origin}/api/mobile/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: `http://127.0.0.1:${PORT}` }, body: JSON.stringify({ email, password, deviceName: 'Demo gateway' }) });
  demoToken = response.ok ? (await response.json()).token : null;
  return demoToken;
}

function send(req, res, headers, body, onResponse) {
  const upstream = forward({ hostname: SITE.hostname, port: SITE.port, method: req.method, path: req.url, headers }, onResponse);
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' }); res.end('The demo dashboard is not running.'); });
  if (body === 'pipe') req.pipe(upstream); else upstream.end();
}
const relay = res => response => { res.writeHead(response.statusCode || 502, frameHeaders({ ...response.headers })); response.pipe(res); };

function proxy(req, res) {
  const headers = { ...req.headers, 'x-forwarded-host': req.headers['x-forwarded-host'] || req.headers.host, 'x-forwarded-proto': req.headers['x-forwarded-proto'] || 'http' };
  if (req.method !== 'GET' || headers.authorization || !IMAGE.test(req.url || '')) return send(req, res, headers, 'pipe', relay(res));
  const signed = token => ({ ...headers, authorization: `Bearer ${token}` });
  (demoToken ? Promise.resolve(demoToken) : signIn()).then(token => send(req, res, signed(token), null, response => {
    if (response.statusCode !== 401) return relay(res)(response);
    // The demo token went stale (e.g. after a reseed): sign in again once.
    response.resume();
    signIn().then(fresh => send(req, res, signed(fresh), null, relay(res)), () => res.writeHead(502).end());
  }), () => res.writeHead(502).end());
}

createServer((req, res) => {
  const { pathname } = new URL(req.url || '/', 'http://demo');
  if (pathname === '/app' || pathname.startsWith('/app/')) serveApp(req, res, pathname).catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); });
  else proxy(req, res);
}).listen(PORT, '127.0.0.1', () => console.log(`FoundKeep demo gateway on http://127.0.0.1:${PORT} (app ${APP_DIR}, dashboard ${SITE.origin})`));
