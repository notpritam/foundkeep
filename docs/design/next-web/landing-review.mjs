import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';

const base = process.env.LANDING_REVIEW_URL || 'http://127.0.0.1:18792';
const output = new URL('./', import.meta.url);
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
const report = {base,checks:[],viewports:[]};
const check = name => report.checks.push(name);
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('.hero-availability').getByRole('status').filter({hasText:'For your browser'}).waitFor();
  for (const [name,width,height] of [['desktop',1440,1000],['tablet',768,1000],['mobile',390,844],['small',320,740]]) {
    await page.setViewportSize({width,height});
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    const state=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth>innerWidth,
      missingImages:[...document.querySelectorAll('.landing-body img')].filter(image=>image.complete&&!image.naturalWidth).map(image=>image.getAttribute('src')),
      primaryActions:document.querySelectorAll('.hero-action-group>.button').length,
      toolbar:document.querySelectorAll('.capture-dock').length,
    }));
    assert.equal(state.overflow,false); assert.deepEqual(state.missingImages,[]);
    assert.equal(state.primaryActions,1); assert.equal(state.toolbar,0);
    report.viewports.push({name,width,height,...state});
    if(name==='desktop'||name==='mobile')await page.screenshot({path:new URL(`landing-hero-${name}.png`,output).pathname});
  }
  check('1440/768/390/320px: no horizontal overflow, one hero action, loaded images and no decorative toolbar');
  await page.setViewportSize({width:390,height:844});
  const toggle=page.locator('.menu-toggle'),nav=page.locator('#mobile-nav');
  await toggle.focus(); await page.keyboard.press('Enter');
  await nav.waitFor({state:'visible'});
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'How it works');
  assert.equal(await nav.locator('a').first().evaluate(node=>getComputedStyle(node).outlineColor),'rgb(8, 108, 168)');
  await page.keyboard.press('Escape'); await nav.waitFor({state:'hidden'});
  assert.equal(await toggle.evaluate(node=>document.activeElement===node),true);
  await toggle.click(); await page.mouse.click(30,560); await nav.waitFor({state:'hidden'});
  await toggle.click(); await page.setViewportSize({width:900,height:1000});
  await nav.waitFor({state:'hidden'});
  // CSS hides the menu synchronously; the media-query event updates React next.
  await page.waitForFunction(()=>document.querySelector('.menu-toggle')?.getAttribute('aria-expanded')==='false',null,{timeout:1000});
  assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await nav.isHidden(),true);
  await toggle.click(); await nav.locator('a').first().click(); await nav.waitFor({state:'hidden'});
  assert.equal(new URL(page.url()).hash,'#capture');
  check('Menu: keyboard activation, visible blue focus, Escape restoration, outside click, resize and anchor dismissal');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');
  assert.equal(await page.locator('.landing-body').evaluate(node=>node.getAnimations({subtree:true}).filter(animation=>animation.playState==='running').length),0);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'smooth');
  await page.locator('#capture').evaluate(node=>window.scrollTo({top:node.getBoundingClientRect().top+scrollY-100,behavior:'instant'}));
  await page.waitForFunction(()=>document.querySelector('#capture')?.parentElement?.getAnimations().some(animation=>animation.playState==='running'));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>!document.querySelector('#capture')?.parentElement?.getAnimations().some(animation=>animation.playState==='running'));
  assert.equal(await page.locator('#capture').locator('..').evaluate(node=>getComputedStyle(node).opacity),'1');
  check('Reduced motion: static initial render, active Motion reveal stops immediately, native scrolling becomes instant');
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const navigation=page.waitForEvent('request',{predicate:request=>request.isNavigationRequest()&&new URL(request.url()).pathname==='/login'});
  await page.locator('.login-link').click();
  await navigation;
  check('Landing login performs a full document navigation for the private CSP boundary');
  assert.deepEqual(errors,[]);
  check('No browser page errors');

  for (const [state,extensionAccount] of [['connected','review-owner'],['installed',null]]) {
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    const fixture=await context.newPage();
    await fixture.route('**/api/me',route=>route.fulfill({json:{account:{id:'review-owner',name:'Review fixture',email:'review@example.com'}}}));
    await fixture.route('**/customer-config.json',route=>route.fulfill({json:{extensionIds:['cficnecbdbiddngllpfbacabgbcjinmk','mjfcgmboaijfcaanepdipbgmipnccnpn'],iphone:{distribution:'private-beta'}}}));
    await fixture.addInitScript(({extensionAccount})=>{
      Object.defineProperty(globalThis,'chrome',{configurable:true,value:{runtime:{sendMessage(id,_message,callback){
        if(id==='cficnecbdbiddngllpfbacabgbcjinmk')setTimeout(()=>callback({ok:true,account:extensionAccount?{id:extensionAccount}:null,version:'1.0.0'}),10);
        // The legacy ID intentionally never responds.
      }}}});
    },{extensionAccount});
    await fixture.goto(base,{waitUntil:'domcontentloaded'});
    await fixture.locator('.install-proof').waitFor({timeout:1800});
    const expected=state==='connected'?'Browser connected':'Extension installed';
    await fixture.locator('.install-proof').filter({hasText:expected}).waitFor({timeout:1800});
    assert.equal(await fixture.locator('.hero-availability').getByText('Request iPhone beta',{exact:true}).count(),1);
    if(state==='installed')assert.equal(await fixture.locator('.hero-availability').getByText('Connect browser',{exact:true}).count(),1);
    await context.close();
    check(`Extension ${state} appears within 1.8 seconds despite a silent legacy ID; installed and connected remain distinct`);
  }
  report.result='pass';
  await writeFile(new URL('landing-review.json',output),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
