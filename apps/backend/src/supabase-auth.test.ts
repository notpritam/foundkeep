import { describe, expect, test } from 'bun:test';
import { createSupabaseGateway, OAuthError } from './supabase-auth.ts';
const env = { SUPABASE_URL: 'https://personal.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test_server_only', FOUNDKEEP_OAUTH_PROVIDERS: 'google,github,apple' };
describe('server-only Supabase gateway', () => {
  test('stays disabled without complete explicit configuration', () => {
    expect(createSupabaseGateway({}).providers).toEqual([]);
    expect(createSupabaseGateway({ ...env, SUPABASE_SECRET_KEY: '' }).providers).toEqual([]);
    expect(createSupabaseGateway({ ...env, SUPABASE_URL: 'http://localhost:1234' }).providers).toEqual([]);
  });
  test('uses backend headers and accepts only the selected provider redirect', async () => {
    const calls: {url: string; init: RequestInit}[] = [];
    const gateway = createSupabaseGateway(env, async (url, init) => {
      calls.push({url: String(url), init: init!});
      return new Response(null, {status: 302, headers: {location: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=public-id'}});
    });
    const url = await gateway.authorize('google', 'https://foundkeep.app/api/auth/oauth/callback/flow', 'v'.repeat(43));
    expect(url).not.toContain(env.SUPABASE_SECRET_KEY);
    expect(calls[0]!.init.redirect).toBe('manual');
    expect(new Headers(calls[0]!.init.headers).get('apikey')).toBe(env.SUPABASE_SECRET_KEY);
    expect(calls[0]!.url).toContain('code_challenge_method=s256');
    const hostile = createSupabaseGateway(env, async () => new Response(null, {status:302,headers:{location:'https://attacker.example/steal'}}));
    await expect(hostile.authorize('google','https://foundkeep.app/callback','v'.repeat(43))).rejects.toBeInstanceOf(OAuthError);
  });
  test('gets verified identity separately and drops every upstream token', async () => {
    let n=0;
    const gateway=createSupabaseGateway(env,async (_url,init)=>{
      n++;
      if(n===1)return Response.json({access_token:'PRIVATE_ACCESS',refresh_token:'PRIVATE_REFRESH',provider_token:'PRIVATE_PROVIDER',user:{email:'forged@example.com'}});
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer PRIVATE_ACCESS');
      return Response.json({id:'d413e14e-7a08-4c8c-a4cf-c5ea9cfe171c',email:'real@example.com',email_confirmed_at:'2026-09-09T00:00:00Z',role:'authenticated',identities:[{provider:'google'}],user_metadata:{full_name:'Real Person'}});
    });
    expect(await gateway.identity('code','v'.repeat(43),'google')).toEqual({subject:'d413e14e-7a08-4c8c-a4cf-c5ea9cfe171c',email:'real@example.com',name:'Real Person'});
  });
  test('rejects unconfirmed email and masks upstream errors', async () => {
    const gateway=createSupabaseGateway(env,async url=>String(url).includes('/token')?Response.json({access_token:'secret'}):Response.json({id:crypto.randomUUID(),email:'x@example.com',role:'authenticated',identities:[{provider:'github'}]}));
    await expect(gateway.identity('code','v'.repeat(43),'github')).rejects.toBeInstanceOf(OAuthError);
    const broken=createSupabaseGateway(env,async()=>new Response('sb_secret_PRIVATE',{status:500}));
    try{await broken.identity('code','v'.repeat(43),'google');throw Error('expected failure');}catch(e){expect(String(e)).not.toContain('sb_secret_PRIVATE');}
  });
});
