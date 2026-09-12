import {expect,test} from 'bun:test';
import {createSourceFetcher,extractSource} from '../src/customer-source.ts';
const html='<html><head><title>A useful page</title><meta property="og:image" content="/image.jpg"><meta name="author" content="Alex"></head><body><nav>Do not include navigation</nav><article><h1>A useful page</h1><p>The original article has useful details.</p><script>throw new Error("Never execute");</script></article></body></html>';
test('public extraction preserves traceable article details and removes executable/navigation content',()=>{
 const result=extractSource(html,'https://example.com/article');expect(result.text).toContain('original article');expect(result.text).not.toContain('Never execute');expect(result.text).not.toContain('navigation');expect(result.imageUrl).toBe('https://example.com/image.jpg');expect(result.author).toBe('Alex');
});
test('source fetching pins public addresses and records original URL, final URL and a content hash',async()=>{
 let calls=0;const fetcher=createSourceFetcher({resolve:async()=>[{address:'1.1.1.1',family:4}],transport:async target=>{
  expect(target.address).toBe('1.1.1.1');calls++;return{status:calls===1?302:200,headers:new Headers(calls===1?{location:'/article'}:{'content-type':'text/html'}),body:(async function*(){yield new TextEncoder().encode(html);})(),cancel(){}};
 }});const result=await fetcher('https://example.com/first');expect(result.requestedUrl).toBe('https://example.com/first');expect(result.url).toBe('https://example.com/article');expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
});
test('private DNS answers and redirects to local addresses never reach the transport',async()=>{
 let calls=0;const fetcher=createSourceFetcher({resolve:async()=>[{address:'127.0.0.1',family:4}],transport:async()=>{calls++;throw new Error('Must not connect.');}});
 await expect(fetcher('https://example.com')).rejects.toThrow('not a public');expect(calls).toBe(0);
 const redirect=createSourceFetcher({resolve:async()=>[{address:'1.1.1.1',family:4}],transport:async()=>({status:302,headers:new Headers({location:'http://169.254.169.254/latest/meta-data/'}),body:(async function*(){})(),cancel(){}})});
 await expect(redirect('https://example.com')).rejects.toThrow('unsupported address');
});
