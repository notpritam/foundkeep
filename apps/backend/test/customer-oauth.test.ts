import { afterEach, beforeEach, expect, test } from 'bun:test';
import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import { randomBytes } from 'node:crypto';
import { openDb } from '../src/db.ts';
import { customerRoutes } from '../src/customer.ts';
import { challenge, type OAuthGateway, type OAuthIdentity } from '../src/supabase-auth.ts';
import { processAuthCleanup } from '../src/customer-oauth.ts';
const origin='https://foundkeep.app'; const password='correct horse battery staple';
let db:Database;let app:Hono;let identity:OAuthIdentity;let gateway:OAuthGateway;
beforeEach(()=>{
 db=openDb(':memory:');identity={subject:crypto.randomUUID(),email:'social@example.com',name:'Social User'};
 gateway={issuer:'https://personal.supabase.co',providers:['apple','google','github'],authorize:async(_p,callback)=>'https://accounts.google.com/auth?redirect='+encodeURIComponent(callback),identity:async()=>identity,deleteUser:async()=>{}};
 app=new Hono().route('/api',customerRoutes(db,gateway));
});
afterEach(()=>db.close());
async function req(path:string,body?:any,cookie?:string,bearer?:string,method=body?'POST':'GET') {
 const headers:Record<string,string>={origin}; if(body)headers['content-type']='application/json';if(cookie)headers.cookie=cookie;if(bearer)headers.authorization='Bearer '+bearer;
 return app.request(origin+'/api'+path,{method,headers,body:body?JSON.stringify(body):undefined});
}
async function begin(client='web',intent='sign-in',bearer?:string,cookie?:string){
 const verifier=randomBytes(32).toString('base64url');const start=await req('/auth/oauth/start',{provider:'google',client,intent,codeChallenge:challenge(verifier)},cookie,bearer);expect(start.status).toBe(200);const data=await start.json()as any;const flowCookie=start.headers.get('set-cookie')?.split(';')[0];
 const browser=await req(new URL(data.authorizeUrl).pathname.slice(4),undefined,flowCookie);expect(browser.status).toBe(302);
 return {...data,verifier,cookie:flowCookie||browser.headers.get('set-cookie')?.split(';')[0]};
}
async function finish(flow:any){const r=await req('/auth/oauth/callback/'+flow.flow+'?code=valid-supabase-code',undefined,flow.cookie);expect(r.status).toBe(302);const url=new URL(r.headers.get('location')!);return {flow:flow.flow,code:url.searchParams.get('code'),verifier:flow.verifier};}
async function register(){const r=await req('/auth/register',{email:identity.email,name:'Existing',password});expect(r.status).toBe(201);return {cookie:r.headers.get('set-cookie')!.split(';')[0],...(await r.json()as any)};}
test('discovery exposes only names and disabled installations cannot start',async()=>{
 expect(await(await req('/auth/providers')).json()).toEqual({providers:['apple','google','github']});
 const disabled=new Hono().route('/api',customerRoutes(db,{...gateway,providers:[]}));const r=await disabled.request(origin+'/api/auth/providers');expect(await r.text()).toBe('{"providers":[]}');
 const start=await req('/auth/oauth/start',{provider:'evil',client:'web',codeChallenge:'x'.repeat(43)});expect(start.status).toBe(400);
});
test('web login needs browser binding and local proof; handoff is one use',async()=>{
 const flow=await begin();const missing=await req('/auth/oauth/callback/'+flow.flow+'?code=code');expect(missing.status).toBe(401);
 const body=await finish(flow);const wrong=await req('/auth/oauth/exchange',{...body,verifier:'x'.repeat(43)},flow.cookie);expect(wrong.status).toBe(401);
 const r=await req('/auth/oauth/exchange',body,flow.cookie);expect(r.status).toBe(200);expect(r.headers.get('set-cookie')).toContain('HttpOnly');const text=await r.text();expect(text).not.toContain('supabase');expect(text).not.toContain('token');const account=JSON.parse(text).account;expect(account.hasPassword).toBe(false);
 expect((await req('/auth/oauth/exchange',body,flow.cookie)).status).toBe(401);
});
test('native login issues only Foundkeep connection after proof',async()=>{
 const flow=await begin('ios');const body=await finish(flow);const r=await req('/auth/oauth/exchange',body);expect(r.status).toBe(200);const data=await r.json()as any;expect(data.token).toMatch(/^[A-Za-z0-9_-]{43}$/);expect((await req('/mobile/me',undefined,undefined,data.token)).status).toBe(200);
});
test('matching email requires existing password before identity can be connected',async()=>{
 const existing=await register();const flow=await begin();const body=await finish(flow);
 expect((await req('/auth/oauth/exchange',body,flow.cookie)).status).toBe(409);
 expect((db.query('SELECT COUNT(*) n FROM customer_auth_identities').get()as any).n).toBe(0);
 expect((await req('/auth/oauth/exchange',{...body,password:'wrong'},flow.cookie)).status).toBe(401);
 const r=await req('/auth/oauth/exchange',{...body,password},flow.cookie);expect(r.status).toBe(200);expect((await r.json()as any).account.id).toBe(existing.account.id);
});
test('expired and swapped handoffs cannot issue credentials',async()=>{
 const a=await begin();const b=await begin();const body=await finish(a);expect((await req('/auth/oauth/exchange',{...body,flow:b.flow},b.cookie)).status).toBe(401);
 db.query('UPDATE customer_oauth_flows SET expires_at=0 WHERE id=?').run(a.flow);expect((await req('/auth/oauth/exchange',body,a.cookie)).status).toBe(401);
});
test('social deletion needs a fresh proof bound to the same live device and cleans identity remotely',async()=>{
 const flow=await begin('ios');const data=await(await req('/auth/oauth/exchange',await finish(flow))).json()as any;
 expect((await req('/mobile/account',{password:'anything'},undefined,data.token,'DELETE')).status).toBe(401);
 const reauth=await begin('ios','delete',data.token);const proof=await(await req('/auth/oauth/exchange',await finish(reauth),undefined,data.token)).json()as any;expect(proof.reauthToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
 const r=await req('/mobile/account',{reauthToken:proof.reauthToken},undefined,data.token,'DELETE');expect(r.status).toBe(200);expect((db.query('SELECT COUNT(*) n FROM customer_accounts').get()as any).n).toBe(0);
 expect((db.query('SELECT COUNT(*) n FROM customer_auth_cleanup').get()as any).n).toBe(1);
 let deleted='';await processAuthCleanup(db,{...gateway,deleteUser:async id=>{deleted=id;}});expect(deleted).toBe(identity.subject);expect((db.query('SELECT COUNT(*) n FROM customer_auth_cleanup').get()as any).n).toBe(0);
});
test('revoking device during provider reauthentication blocks redemption',async()=>{
 const first=await begin('ios');const data=await(await req('/auth/oauth/exchange',await finish(first))).json()as any;
 const flow=await begin('ios','delete',data.token);const body=await finish(flow);await req('/mobile/logout',{},undefined,data.token);
 expect((await req('/auth/oauth/exchange',body,undefined,data.token)).status).toBe(401);
});
test('iOS social methods require Apple to be configured',async()=>{
 const target=new Hono().route('/api',customerRoutes(db,{...gateway,providers:['google']}));
 expect(await(await target.request(origin+'/api/auth/providers?client=ios')).json()).toEqual({providers:[]});
});
test('deletion invalidates completed sign-ins even after remote cleanup succeeds',async()=>{
 const first=await begin('ios');const data=await(await req('/auth/oauth/exchange',await finish(first))).json()as any;
 const stale=await begin('ios');const staleBody=await finish(stale);
 const proofFlow=await begin('ios','delete',data.token);const proof=await(await req('/auth/oauth/exchange',await finish(proofFlow),undefined,data.token)).json()as any;
 await req('/mobile/account',{reauthToken:proof.reauthToken},undefined,data.token,'DELETE');await processAuthCleanup(db,gateway);
 expect((await req('/auth/oauth/exchange',staleBody)).status).not.toBe(200);expect((db.query('SELECT COUNT(*) n FROM customer_accounts').get()as any).n).toBe(0);
});
test('a provider callback already in flight cannot recreate a deleted identity',async()=>{
 const first=await begin('ios');const data=await(await req('/auth/oauth/exchange',await finish(first))).json()as any;
 const proofFlow=await begin('ios','delete',data.token);const proof=await(await req('/auth/oauth/exchange',await finish(proofFlow),undefined,data.token)).json()as any;
 const stale=await begin('ios');let release!:(value:OAuthIdentity)=>void;
 gateway.identity=()=>new Promise(resolve=>{release=resolve;});
 const callback=req('/auth/oauth/callback/'+stale.flow+'?code=delayed',undefined,stale.cookie);
 await new Promise(resolve=>setTimeout(resolve,0));
 await req('/mobile/account',{reauthToken:proof.reauthToken},undefined,data.token,'DELETE');await processAuthCleanup(db,gateway);
 release(identity);const response=await callback;expect(response.headers.get('location')).toContain('error=oauth_failed');
 expect((db.query('SELECT COUNT(*) n FROM customer_accounts').get()as any).n).toBe(0);
});
test('native hex PKCE verifiers are supported without weakening challenge validation',async()=>{
 const verifier=randomBytes(32).toString('hex');const start=await req('/auth/oauth/start',{provider:'google',client:'ios',codeChallenge:challenge(verifier)});
 const flow=await start.json()as any;const browser=await req('/auth/oauth/authorize/'+flow.flow);flow.cookie=browser.headers.get('set-cookie')?.split(';')[0];flow.verifier=verifier;
 expect((await req('/auth/oauth/exchange',await finish(flow))).status).toBe(200);
});
