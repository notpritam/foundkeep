// Real extension + web shell. Use a disposable backend, or explicit temporary
// live accounts only with an explicit per-environment release-test opt-in.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
const exec=promisify(execFile);
const base=process.env.BASE_URL || 'http://127.0.0.1:18791';
const host=new URL(base).hostname;
assert.ok(['localhost','127.0.0.1'].includes(host) || (base==='https://dev.foundkeep.app' && process.env.FOUNDKEEP_ALLOW_DEV_TEST==='1') || (base==='https://foundkeep.app' && process.env.FOUNDKEEP_ALLOW_PROD_TEST==='1'), 'Use a disposable backend or explicitly opt into temporary accounts on the selected environment.');
const candidate=process.env.FOUNDKEEP_CANDIDATE_URL;
if(candidate)assert.ok(['localhost','127.0.0.1'].includes(new URL(candidate).hostname));
const environment=base==='https://foundkeep.app'?'prod':'dev';
const id=environment==='prod'?'mjfcgmboaijfcaanepdipbgmipnccnpn':'fngoidplpdpoamenhgpabbheghpkdkcb';
const waitFor=async(fn)=>{for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw new Error('Timed out waiting for automatic connection');};

test('installed extension auto-connects from the library, stays paired across routes and preserves account confirmation', {timeout:90000}, async t=>{
 const temporary=await mkdtemp('/tmp/foundkeep-auto-connect-');let context;
 const accounts=[];
 t.after(async()=>{
  let cleanupError;
  for(const account of accounts){try{const response=await context.request.delete(base+'/api/account',{headers:{Origin:base,Cookie:account.cookie},data:{password:account.password}});assert.ok(response.ok(),'Delete only the temporary test account');}catch(error){cleanupError=error;}}
  await context?.close();await rm(temporary,{recursive:true,force:true});if(cleanupError)throw cleanupError;
 });
 if(!process.env.FOUNDKEEP_TEST_EXTENSION)await exec('node',['deploy/build-extension.mjs','--environment',environment,'--output',temporary]);
 const directory=process.env.FOUNDKEEP_TEST_EXTENSION?path.resolve(process.env.FOUNDKEEP_TEST_EXTENSION):path.join(temporary,'foundkeep-extension-'+environment);
 if(['localhost','127.0.0.1'].includes(host)){
  assert.ok(!process.env.FOUNDKEEP_TEST_EXTENSION,'Never rewrite a supplied release artifact for a loopback fixture.');
  const file=path.join(directory,'manifest.json');const manifest=JSON.parse(await readFile(file,'utf8'));
  manifest.host_permissions=[base+'/*'];manifest.externally_connectable={matches:[base+'/*']};await writeFile(file,JSON.stringify(manifest));
  const product=path.join(directory,'src/product.js');await writeFile(product,(await readFile(product,'utf8')).replaceAll('https://dev.foundkeep.app',base));
 }
 context=await chromium.launchPersistentContext(path.join(temporary,'profile'),{headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox',`--disable-extensions-except=${directory}`,`--load-extension=${directory}`]});
 let issuedCodes=0;const errors=[];
 context.on('request',r=>{if(r.url()===base+'/api/pairing'&&r.method()==='POST')issuedCodes++;});
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await context.route(base+'/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/customer-config.json'&&['localhost','127.0.0.1'].includes(host))return route.fulfill({contentType:'application/json',body:await readFile(path.join(temporary,'customer-config.json'),'utf8')});
  if(!candidate || url.pathname.startsWith('/api/'))return route.continue();
  const response=await context.request.fetch(candidate+url.pathname+url.search,{headers:{...route.request().headers(),host:new URL(base).host,'x-forwarded-host':new URL(base).host,'x-forwarded-proto':new URL(base).protocol.slice(0,-1)}});
  return route.fulfill({response});
 });
 const register=async()=>{
  const password='Autoconnect-test-'+crypto.randomUUID();
  const response=await context.request.post(base+'/api/auth/register',{headers:{Origin:base},data:{name:'Temporary automatic connection check',email:`auto-${crypto.randomUUID()}@example.test`,password}});
  assert.equal(response.status(),201);
  const cookie=response.headers()['set-cookie'].split(';')[0];const me=await context.request.get(base+'/api/me');const account={...(await me.json()).account,password,cookie};accounts.push(account);return account;
 };
 // Before sign-in, merely installing the extension never pairs an account.
 // dock-settings.html is a neutral extension-page context here, the role
 // popup.html/library.html used to play (both deleted in Task 7).
 const ext=await context.newPage();await ext.goto(`chrome-extension://${id}/src/dock-settings.html`);
 assert.equal(await ext.evaluate(async()=> (await chrome.runtime.sendMessage({kind:'cloud-status'})).account),null);
 const accountA=await register();
 const page=await context.newPage();await page.goto(base+'/dashboard');
 await waitFor(async()=>await ext.evaluate(async()=> (await chrome.runtime.sendMessage({kind:'cloud-status'})).account?.id)===accountA.id);
 assert.equal(issuedCodes,1,'Opening My library should issue exactly one automatic pairing code');
 const folderResponse=await context.request.post(base+'/api/mobile/folders',{headers:{Origin:base},data:{name:'Temporary extension destination'}});assert.equal(folderResponse.status(),201);const folder=(await folderResponse.json()).folder;
 const pageTabId=await ext.evaluate(url=>chrome.tabs.query({url}).then(tabs=>tabs[0].id),base+'/*');
 // Save through the dock's own review flow (stage, then confirm) — the
 // sidebar's own inline destination dialog these two saves used to drive
 // directly (#newNote/#saveDestination/#destinationConfirm, …) is deleted
 // in Task 7 along with library.html itself.
 async function saveThroughDock(action, extra, choice) {
   await ext.evaluate(async ({ tabId, action, extra }) => {
     const { stageSaveReview } = await import('./save-review.js');
     await stageSaveReview({ action, tab: await chrome.tabs.get(tabId), trigger: 'dock', ...extra });
   }, { tabId: pageTabId, action, extra });
   const { draft } = await ext.evaluate(tabId => chrome.runtime.sendMessage({ kind: 'save-review-get', tabId }), pageTabId);
   return ext.evaluate(({ tabId, id, choice }) => chrome.runtime.sendMessage({ kind: 'save-review-confirm', tabId, id, choice }), { tabId: pageTabId, id: draft.id, choice });
 }
 const note='Automatic dev sync check '+crypto.randomUUID();
 const titledSave=await saveThroughDock('note',{text:note},{kind:'library',details:{noteText:note,sourceTitle:'A titled note',folderId:folder.id,userTags:['Personal','To test']}});
 assert.equal(titledSave.ok,true,JSON.stringify(titledSave));
 await waitFor(async()=> (await (await context.request.get(base+'/api/captures')).json()).captures.some(c=>c.noteText===note&&c.folderId===folder.id));
 const titled=(await(await context.request.get(base+'/api/captures')).json()).captures.find(c=>c.noteText===note);assert.equal(titled.sourceTitle,'A titled note');assert.deepEqual(titled.userTags,['Personal','To test']);
 const collectionResponse=await context.request.post(base+'/api/collections',{headers:{Origin:base},data:{title:'Temporary destination review',slug:'review-'+crypto.randomUUID(),kind:'personal',visibility:'private',submissionPolicy:'owner'}});assert.equal(collectionResponse.status(),201);const collection=(await collectionResponse.json()).collection;
 const privateText='Private annotation '+crypto.randomUUID(),sharedText='Only the quote chosen for this collection.';
 const collectionSave=await saveThroughDock('note',{text:privateText},{
   kind:'collection',id:collection.id,visibility:'private',
   details:{noteText:privateText+' — extra private context',userTags:['Private research']},
   entry:{title:'A chosen quote',url:'',body:sharedText,tags:['Team references'],shareImage:false},
 });
 assert.equal(collectionSave.ok,true,JSON.stringify(collectionSave));
 await waitFor(async()=> (await (await context.request.get(base+'/api/collections/'+collection.id)).json()).entries.some(entry=>entry.body===sharedText));
 const entries=(await(await context.request.get(base+'/api/collections/'+collection.id)).json()).entries;assert.ok(!JSON.stringify(entries).includes(privateText));
 assert.ok(!JSON.stringify(entries).includes('Private research'));assert.deepEqual(entries.find(entry=>entry.body===sharedText).tags,['Team references']);
 const privateCopy=(await(await context.request.get(base+'/api/captures')).json()).captures.find(c=>c.noteText===privateText+' — extra private context');assert.ok(privateCopy);assert.deepEqual(privateCopy.userTags,['Private research']);
 await page.locator('#open-setup').click();await page.waitForURL('**/dashboard/apps');
 await waitFor(async()=>await page.locator('#browser-connection-badge').textContent()==='Connected here');
 assert.equal(await page.locator('#connect-extension').isVisible(),false,'No redundant connect button for an already connected account');
 await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('focus'));});
 await page.locator('#open-settings').click();await page.waitForURL('**/dashboard/settings');
 assert.equal(issuedCodes,1,'Route changes and repeated focus must not create extra browser credentials');
 // Another signed-in account cannot silently take ownership of the extension.
 const accountB=await register();await page.goto(base+'/dashboard/apps');
 await page.getByRole('button',{name:'Switch FoundKeep account',exact:true}).waitFor();
 assert.equal(issuedCodes,1);assert.equal(await ext.evaluate(async()=> (await chrome.runtime.sendMessage({kind:'cloud-status'})).account?.id),accountA.id);
 await page.getByRole('button',{name:'Switch FoundKeep account',exact:true}).click();
 await page.getByRole('heading',{name:'Switch this browser’s account?',exact:true}).waitFor();
 assert.equal(issuedCodes,1,'Account confirmation must happen before issuing a switch code');
 await page.getByRole('button',{name:'Switch account',exact:true}).click();
 await waitFor(async()=>await ext.evaluate(async()=> (await chrome.runtime.sendMessage({kind:'cloud-status'})).account?.id)===accountB.id);
 assert.equal(issuedCodes,2);
 // Explicit disconnect remains effective even if the website regains focus.
 await ext.evaluate(()=>chrome.runtime.sendMessage({kind:'cloud-disconnect'}));
 await page.reload();await page.getByText('You disconnected this browser. Connect it again when you’re ready.',{exact:true}).waitFor();
 assert.equal(issuedCodes,2);assert.equal(await ext.evaluate(async()=> (await chrome.runtime.sendMessage({kind:'cloud-status'})).account),null);
 assert.deepEqual(errors,[]);
});
