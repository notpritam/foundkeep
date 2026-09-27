import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {actionPanel} from './helpers/action-panel.mjs';
import {dockWorld} from './helpers/dock-world.mjs';
import {pollUntil} from './helpers/poll.mjs';

// Task 4: an X save no longer opens the native side panel (saveTweet now
// goes through startCapture, same as every other capture path) — it opens
// the review card framed in the floating dock, on the tweet's own tab. Only
// the older, still-side-panel-backed dashboard note flow at the end of this
// test (prepare-legacy-save keeps calling openReviewPanel) still uses
// actionPanel.
async function reviewFrame(page, timeout = 5000) {
 const deadline = Date.now() + timeout;
 while (Date.now() < deadline) {
  const frame = page.frames().find(f => f.url().includes('review.html'));
  if (frame) return frame;
  await new Promise(r => setTimeout(r, 50));
 }
 throw new Error('review.html frame did not appear');
}

test('an X save opens a destination review without saving until confirmation, and cancel saves nothing', {timeout:30000}, async t=>{
 const profile=await mkdtemp('/tmp/foundkeep-destination-');let context;
 t.after(async()=>{await context?.close();await rm(profile,{recursive:true,force:true});});
 const extension=process.env.FOUNDKEEP_TEST_EXTENSION||path.resolve('apps/extension');
 context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:process.env.FOUNDKEEP_HEADLESS!=='false',executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
 const extensionId=new URL(worker.url()).host;
 // Saving now requires a signed-in account; use a fixture account with no
 // real network, mocking the destination-loading and sync endpoints it hits.
 await worker.evaluate(()=>chrome.storage.local.set({atlasCustomer:{account:{id:'account-a'},connection:{id:'connection-a'},token:'token-a',status:'connected'}}));
 await context.route('**/api/organization',route=>route.fulfill({json:{folders:[],tags:[],suggestedTags:[]}}));
 await context.route('**/api/collections',route=>route.fulfill({json:{collections:[]}}));
 await context.route('**/api/captures',route=>route.fulfill({json:{capture:{id:'remote-1',status:'done'}}}));
 await context.route('https://x.com/**',route=>route.fulfill({contentType:'text/html',body:`<title>X fixture</title><article data-testid="tweet"><div data-testid="User-Name">Mina</div><a href="/mina/status/123456789"><time>Today</time></a><div data-testid="tweetText">A tweet worth keeping.</div><div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/own.jpg"></div><div data-testid="card.wrapper"><a href="https://t.co/blog" title="https://example.org/blog">Blog</a></div><div role="link"><a href="/neighbor/status/999">A quoted post</a><div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/quoted.jpg"></div><div data-testid="tweetText"><a href="https://example.org/quoted">Quoted link</a></div></div><div data-testid="videoPlayer"><div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/poster.jpg"></div></div><div data-testid="twitterArticleRichTextView">Visible long-form article</div><div role="group"><button data-testid="reply">Reply</button></div></article>`}));
 const web=await context.newPage();await web.goto('https://x.com/home');
 // x.com isn't covered by any host permission (only a content_scripts
 // match), so chrome.tabs.query cannot filter on its url; capture its id via
 // "active" while it is the only candidate, before the ext page below takes
 // over activeness.
 const webTabId=await worker.evaluate(async()=>(await chrome.tabs.query({active:true,currentWindow:true}))[0].id);
 const ext=await context.newPage();await ext.goto(await worker.evaluate(()=>chrome.runtime.getURL('src/popup.html')));
 const count=()=>ext.evaluate("import('./db.js').then(db=>db.listCaptures()).then(rows=>rows.length)");

 const button=web.locator('article [data-state]');await button.waitFor();await button.click();
 await web.waitForFunction(()=>document.querySelector('article [data-state]').dataset.state!=='saving');
 assert.equal(await button.getAttribute('data-state'),'choosing','Clicking an X button must review the destination, not immediately save');
 const dock=await dockWorld(web,extensionId);
 await dock.waitFor(`__foundkeepDock.state() === 'review'`);
 let frame=await reviewFrame(web);
 await frame.waitForSelector('#reviewForm[data-ready="true"]');
 assert.equal(await count(),0);
 await frame.click('#reviewCancel');
 await pollUntil(ext,webTabId=>import('./save-review.js').then(m=>m.readSaveReview(webTabId)).then(d=>!d),webTabId);
 assert.equal(await count(),0);

 await button.click();await dock.waitFor(`__foundkeepDock.state() === 'review'`);
 frame=await reviewFrame(web);
 await frame.waitForSelector('#reviewForm[data-ready="true"]');
 await frame.fill('#destinationPersonalTitle','UI references');
 await frame.fill('#reviewNote','Use these for our next project');
 await frame.evaluate(()=>{document.querySelector('#destinationTags input').value='UI, React';document.querySelector('#destinationTags .save-tag-entry button').click();});
 await frame.waitForSelector('#destinationTags .selected',{state:'attached'});
 // The debounced auto-save writes the draft to storage — the source of
 // truth a reopened card would restore from (proved directly by Task 4's
 // "reload mid-review" dock-flow test) — not just the frame's own DOM state.
 await pollUntil(ext,()=>chrome.storage.session.get(null).then(values=>Object.values(values).some(draft=>draft?.form?.note==='Use these for our next project'&&draft.form.tags.length===2)),null);
 assert.equal(await frame.$$eval('#destinationTags .selected',els=>els.length),2);
 await frame.selectOption('#saveDestination','library');
 await frame.dispatchEvent('#saveDestination','change');
 // A coordinate-based click can miss: filling the note/title/tags above
 // grows the card, and each growth posts a "resize" message that dock.js
 // uses to reposition the card (placeCard) on the page it is framed into,
 // which can move the button between the click's actionability check and
 // its dispatch. review.js's submit handler does not require a trusted
 // event, so click the element directly instead of by coordinate.
 await frame.evaluate(()=>document.querySelector('#destinationConfirm').click());
 await pollUntil(ext,()=>import('./db.js').then(m=>m.listCaptures()).then(rows=>rows.length===1),null);
 assert.equal(await count(),1);
 const saved=await ext.evaluate("import('./db.js').then(db=>db.listCaptures()).then(rows=>rows[0])");
 assert.equal(saved.selectionText,'A tweet worth keeping.');assert.equal(saved.cloudAccountId,'account-a');
 assert.equal(saved.sourceTitle,'UI references');assert.equal(saved.noteText,'Use these for our next project');assert.deepEqual(saved.userTags,['UI','React']);
 assert.equal(saved.sourceUrl,'https://x.com/mina/status/123456789');
 assert.deepEqual(saved.socialContext,{version:1,images:['https://pbs.twimg.com/media/own.jpg'],links:['https://example.org/blog'],articleText:'Visible long-form article'});
 await web.waitForFunction(()=>document.querySelector('article [data-state]').dataset.state==='saved');
 assert.doesNotMatch(await button.getAttribute('aria-label'),/atlas/i);
 // The draft survives a fresh module instance, and a different account cannot
 // take over an outstanding save, even if it chooses local storage.
 await button.click();await dock.waitFor(`__foundkeepDock.state() === 'review'`);
 frame=await reviewFrame(web);
 await frame.waitForSelector('#reviewForm[data-ready="true"]');
 const pending=await ext.evaluate(webTabId=>import('./save-review.js?fresh').then(m=>m.readSaveReview(webTabId)),webTabId);
 assert.equal(pending.tweet.text,'A tweet worth keeping.');
 await ext.evaluate("chrome.storage.local.set({atlasCustomer:{account:{id:'different-account'},connection:{id:'different-connection'},token:null,status:'reconnect'}})");
 const denied=await ext.evaluate(`chrome.runtime.sendMessage({kind:'save-review-confirm',tabId:${pending.tab.id},id:${JSON.stringify(pending.id)},choice:{kind:'local'}})`);
 assert.equal(denied.ok,false);assert.match(denied.error,/account changed/);assert.equal(await count(),1);
 // Leave a (still signed-in, if different) account in place: saving keeps
 // requiring an account, so the legacy dashboard note below must stage too.
 await frame.click('#reviewCancel');
 await pollUntil(ext,webTabId=>import('./save-review.js').then(m=>m.readSaveReview(webTabId)).then(d=>!d),webTabId);

 // A retained local-library tab must use the same native review, never silently
 // save to the current account when the user writes a note there. This still
 // goes through the native side panel (prepare-legacy-save's own
 // openReviewPanel call, unchanged by Task 4), not the dock.
 const legacy = await context.newPage();
 await legacy.goto(new URL('dashboard.html', worker.url()).href);
 const panel = await actionPanel(context, legacy, worker);
 await legacy.locator('#newNote').click();
 await legacy.locator('#libraryNote').fill('A note from the older local library');
 await legacy.locator('#saveLibraryNote').click();
 await panel.waitFor('document.querySelector("#destinationDialog").open');
 assert.equal(await count(), 1, 'The older screen must wait for a destination');
 assert.equal(await legacy.locator('#libraryNote').inputValue(), 'A note from the older local library');
 await panel.evaluate('document.querySelector("#destinationCancel").click()');
 assert.equal(await count(), 1);

});
