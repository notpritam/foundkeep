import {createServer} from 'node:http';
import {readFile,stat,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const root=path.resolve(process.env.FOUNDKEEP_MOBILE_WEB_EXPORT || '.expo/oauth-preview');
const server=createServer(async(req,res)=>{let file=path.join(root,new URL(req.url,'http://local').pathname);if(!(await stat(file).catch(()=>null))?.isFile())file=path.join(root,'index.html');res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(await readFile(file));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port,flow='a'.repeat(32),code='b'.repeat(43);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || undefined});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});const errors=[];let exchange;
 await context.addInitScript(()=>{window.open=(url)=>{window.__openedUrl=url;return null;};});
 await context.route('https://foundkeep.app/**',route=>{
 const p=new URL(route.request().url()).pathname;
 let body={};
 if(p==='/api/auth/providers')body={providers:['apple','google','github']};
 if(p==='/api/auth/oauth/start')body={flow,authorizeUrl:'https://foundkeep.app/api/auth/oauth/authorize/'+flow};
 if(p==='/api/auth/oauth/exchange'){exchange=route.request().postDataJSON();body={error:'account_link_required',message:'Enter your current Foundkeep password to connect.'};return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify(body)});}
 return route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/sign-in');await page.getByRole('button',{name:'Continue with Apple'}).waitFor();
 await page.getByRole('button',{name:'Continue with Google'}).click();
 await page.waitForFunction(()=>window.__openedUrl?.includes('/api/auth/oauth/authorize/'));
 assert.equal(await page.evaluate(()=>window.__openedUrl),'https://foundkeep.app/api/auth/oauth/authorize/'+flow);
 await page.evaluate(({flow,code})=>{history.pushState(null,'','/oauth/complete?flow='+flow+'&code='+code);dispatchEvent(new PopStateEvent('popstate'));},{flow,code});
 await page.getByRole('textbox',{name:'Foundkeep password',exact:true}).waitFor({timeout:10000}).catch(async error=>{console.log(JSON.stringify({url:page.url(),body:await page.locator('body').innerText(),errors,exchange:!!exchange}));throw error;});
 assert.match(exchange.verifier,/^[a-f0-9]{64}$/);assert.equal(exchange.code,code);
 const evidence=path.resolve('../../.impeccable/review/oauth');await mkdir(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,'iphone-connect-existing.png')});
 await page.getByRole('button',{name:'Back to sign in'}).click();await page.getByText('Your collection awaits.',{exact:true}).waitFor();
 await page.goto(base+'/oauth/complete?flow='+flow+'&code='+code);await page.getByText('This sign-in expired or the app restarted. Please start again.',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS compiled mobile: provider start, browser handoff, callback proof, existing-account confirmation, cancel, cold-start rejection');
}finally{await browser.close();server.close();}
