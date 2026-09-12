import {test} from 'node:test';
import assert from 'node:assert/strict';
import {libraryOperation,trustedLibrarySender} from '../apps/extension/src/library-api.js';
test('sidebar operations cannot choose remote origins, credentials or arbitrary paths',()=>{
 assert.throws(()=>libraryOperation('fetch',{url:'https://evil.test'}));
 for(const id of ['../connections','x?secret=true','https://evil.test','a/b'])assert.throws(()=>libraryOperation('detail',{id}));
 const request=libraryOperation('list',{q:'hello&folderId=foreign',folderId:'owned',url:'https://evil.test'});
 const url=new URL(request.path,'https://foundkeep.app');assert.equal(url.searchParams.get('q'),'hello&folderId=foreign');assert.equal(url.searchParams.get('folderId'),'owned');assert.equal(request.method,'GET');
 assert.equal(libraryOperation('preview',{id:'owned-id'}).path,'/api/mobile/captures/owned-id/preview');
});
test('only packaged library and popup pages can proxy customer content',()=>{
 const runtime={id:'own-extension',getURL:path=>'chrome-extension://own-extension/'+path};
 assert.equal(trustedLibrarySender({id:runtime.id,url:runtime.getURL('src/library.html')},runtime),true);
 for(const sender of [{id:'other',url:runtime.getURL('src/library.html')},{id:runtime.id,url:'https://foundkeep.app/dashboard'},{id:runtime.id,url:runtime.getURL('src/twitter.js')},{id:runtime.id,url:runtime.getURL('src/library.html/evil')}])assert.equal(trustedLibrarySender(sender,runtime),false);
});
