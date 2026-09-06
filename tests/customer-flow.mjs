import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, cp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { once } from 'node:events';
import { chromium } from 'playwright-core';

const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function poll(fn, timeout=25000) {
  const end=Date.now()+timeout;
  while(Date.now()<end) { const result=await fn(); if(result) return result; await sleep(300); }
  throw new Error('Customer flow did not reach the expected state');
}
async function rewrite(directory, origin) {
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const file=path.join(directory,entry.name);
    if(entry.isDirectory()) await rewrite(file,origin);
    else if(/\.(js|json)$/.test(entry.name)) {
      const text=await readFile(file,'utf8');
      await writeFile(file,text.replaceAll('https://atlas.notpritam.in',origin));
    }
  }
}

test('customer signs up, connects the real extension, captures text and screenshot, and sees an isolated cloud library', {timeout:120000}, async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'atlas-customer-flow-'));
  const reserve=net.createServer(); reserve.listen(0,'127.0.0.1'); await once(reserve,'listening');
  const port=reserve.address().port; await new Promise(resolve=>reserve.close(resolve));
  // Opt-in production verification creates and deletes only its own QA account.
  const deployedOrigin=process.env.ATLAS_CUSTOMER_SITE_URL;
  const origin=deployedOrigin ? new URL(deployedOrigin).origin : `http://127.0.0.1:${port}`;
  const extension=path.join(directory,'extension');
  await cp(path.resolve('apps/extension'),extension,{recursive:true});
  await rewrite(extension,origin);
  const manifest=JSON.parse(await readFile(path.join(extension,'manifest.json'),'utf8'));
  manifest.externally_connectable={matches:[`${new URL(origin).protocol}//${new URL(origin).hostname}/*`]};
  await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
  const backend=deployedOrigin ? null : spawn(process.env.BUN_BIN || 'bun',['run','apps/backend/src/index.ts'],{
    cwd:process.cwd(),env:{...process.env,ATLAS_PORT:String(port),ATLAS_CUSTOMER_ORIGIN:origin,ATLAS_DATA_DIR:path.join(directory,'data')},stdio:['ignore','pipe','pipe'],
  });
  let backendOutput=''; backend?.stdout.on('data',data=>backendOutput+=data); backend?.stderr.on('data',data=>backendOutput+=data);
  const fixture=http.createServer((_req,res)=>{
    res.writeHead(200,{'content-type':'text/html'});
    res.end('<!doctype html><title>Typography workshop</title><style>body{margin:48px;background:white;color:black;font:32px Arial}article{height:450px}</style><article><h1>Typography workshop</h1><p id="selection">Good design makes information easy to find.</p><p>Save the ideas you want to use again.</p></article>');
  });
  fixture.listen(0,'127.0.0.1');await once(fixture,'listening');
  let context;
  try {
    await poll(async()=>{ if(backend && backend.exitCode!==null) throw new Error(backendOutput);return fetch(origin+'/healthz').then(r=>r.ok).catch(()=>false); });
    context=await chromium.launchPersistentContext(path.join(directory,'profile'),{
      channel:'chromium',headless:true,executablePath:process.env.CHROMIUM_PATH || undefined,
      args:['--no-sandbox',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],
    });
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id=new URL(worker.url()).host;
    assert.equal(id,'mjfcgmboaijfcaanepdipbgmipnccnpn');
    await worker.evaluate(()=>chrome.storage.local.set({enrichEnabled:false}));
    const account=await context.newPage();
    const errors=[]; account.on('pageerror',error=>errors.push(error.message));
    await account.goto(origin+'/auth.html');
    const email=`qa-${Date.now()}@example.invalid`;
    await account.locator('#name').fill('Atlas customer');
    await account.locator('#email').fill(email);
    await account.locator('#password').fill('a-long-test-password-2026');
    await account.locator('#auth-submit').click();
    await account.locator('#new-recovery-code').waitFor({state:'visible'});
    assert.ok((await account.locator('#new-recovery-code').textContent()).length>20);
    await account.locator('#recovery-saved').check();
    await account.locator('#continue-dashboard').click();
    await account.waitForURL('**/dashboard.html');
    const request=async(method,url,body)=>{
      const response=await context.request.fetch(origin+url,{method,headers:{Origin:origin},data:body});
      const data=await response.json();assert.ok(response.ok(),JSON.stringify(data));return data;
    };
    const me=await request('GET','/api/me');assert.equal(me.account.email,email);
    const pair=await request('POST','/api/pairing',{});
    const connection=await account.evaluate(({id,code})=>new Promise(resolve=>{
      chrome.runtime.sendMessage(id,{kind:'atlas-connect',code},response=>resolve(response || {ok:false,error:chrome.runtime.lastError?.message}));
    }),{id,code:pair.code});
    assert.equal(connection.ok,true,JSON.stringify(connection));
    assert.equal(connection.account.id,me.account.id);
    const ping=await account.evaluate(id=>new Promise(resolve=>chrome.runtime.sendMessage(id,{kind:'atlas-ping'},resolve)),id);
    assert.equal(ping.account.id,me.account.id);assert.equal(ping.token,undefined);
    const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/src/popup.html`);
    const note='Remember the typography workshop and bring a notebook.';
    const saved=await popup.evaluate(text=>chrome.runtime.sendMessage({kind:'saveNote',text}),note);
    assert.equal(saved.ok,true,JSON.stringify(saved));
    await poll(async()=>{const result=await request('GET','/api/captures');return result.captures.some(c=>c.noteText===note && c.status==='done');});
    const page=await context.newPage();await page.goto(`http://127.0.0.1:${fixture.address().port}/`);
    await page.evaluate(()=>{const r=document.createRange();r.selectNodeContents(document.querySelector('#selection'));getSelection().addRange(r);});
    await page.bringToFront();
    await popup.evaluate(()=>chrome.runtime.sendMessage({kind:'capture',action:'highlight'}));
    await poll(async()=>{const result=await request('GET','/api/captures');return result.captures.some(c=>c.selectionText?.includes('Good design'));});
    await page.bringToFront();
    await popup.evaluate(()=>chrome.runtime.sendMessage({kind:'capture',action:'fullpage'}));
    const screenshot=await poll(async()=>{const result=await request('GET','/api/captures');return result.captures.find(c=>c.type==='screenshot'&&c.status==='done');},45000);
    assert.match(screenshot.ocrText,/Typography workshop/i);
    const blob=await context.request.get(origin+screenshot.blobUrl);assert.equal(blob.status(),200);assert.match(blob.headers()['content-type'],/image\/(png|jpeg|webp)/);
    await account.reload();
    await account.getByText(note,{exact:false}).first().waitFor();
    assert.equal(errors.length,0,errors.join('\n'));
    // Requests without the owning session cannot see the capture or its image.
    assert.equal((await fetch(origin+'/api/captures/'+screenshot.id)).status,401);
    assert.equal((await fetch(origin+screenshot.blobUrl)).status,401);
    const after=await request('GET','/api/me');assert.equal(after.connections.length,1);assert.equal(after.usage.captures,3);
    await request('DELETE','/api/connections/'+after.connections[0].id);
    await popup.evaluate(()=>chrome.runtime.sendMessage({kind:'saveNote',text:'Saved safely after connection revoked'}));
    await sleep(1500);
    assert.equal((await request('GET','/api/me')).usage.captures,3);
    // A revoked upload never discards the local copy.
    const local=await popup.evaluate(async()=>{const db=await import('./db.js');return db.listCaptures();});
    assert.ok(local.some(c=>c.noteText==='Saved safely after connection revoked'));
    await request('DELETE','/api/account',{password:'a-long-test-password-2026'});
    assert.equal((await context.request.get(origin+'/api/me')).status(),401);
  } finally {
    await context?.close();backend?.kill('SIGTERM');
    if(backend?.exitCode===null) await Promise.race([once(backend,'exit'),sleep(3000)]);
    if(backend?.exitCode===null) backend.kill('SIGKILL');
    await new Promise(resolve=>fixture.close(resolve));
    await rm(directory,{recursive:true,force:true});
  }
});
