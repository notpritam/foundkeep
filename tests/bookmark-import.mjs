import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBookmarkHtml, flattenBookmarkTree } from '../apps/extension/src/bookmark-import.js';

test('browser HTML retains nested folders, entities, descriptions, tags and original dates', () => {
  const result = parseBookmarkHtml(`<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
    <DT><H3>Bookmarks &amp; research</H3><DL><p><DT><H3>Design</H3><DL><p>
    <DT><A HREF="https://example.com/?a=1&amp;b=2" ADD_DATE="1700000000" TAGS="craft,read later">A &#x1f331; &quot;idea&quot;</A>
    <DD>Some <b>useful</b> context &lt;here&gt;.
    </DL><p></DL><p><DT><A HREF='https://github.com'>GitHub</A></DL>`);
  assert.equal(result.entries.length, 2);
  assert.deepEqual(result.entries[0], { url: 'https://example.com/?a=1&b=2', title: 'A 🌱 "idea"', folderPath: ['Bookmarks & research', 'Design'], addedAt: 1700000000000, tags: ['craft', 'read later'], description: 'Some useful context <here>.' });
  assert.deepEqual(result.entries[1].folderPath, []);
});
test('import does not interpret scripts, embedded markup, credential URLs or unsafe schemes', () => {
  const result = parseBookmarkHtml(`<DL><script><A HREF="https://evil.example">Fake</A></script><DT><A HREF="javascript:alert(1)">Bad</A><DT><A HREF="https://user:pass@example.com">Secret</A><DT><A HREF="file:///private">Local</A><DT><A HREF="https://safe.example/?q=>">&lt;img src=x&gt;</A></DL>`);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].title, '<img src=x>');
  assert.equal(result.entries[0].url, 'https://safe.example/?q=%3E');
  assert.equal(result.skipped, 3);
});
test('browser trees preserve ordering, source IDs and dates without changing input', () => {
  const nodes = [{ id: '0', title: '', children: [{ id: '1', title: 'Favorites', children: [{ id: '2', title: 'Read', children: [{ id: '3', title: 'A page', url: 'https://EXAMPLE.com:443/a#part', dateAdded: 1700000000000 }] }] }] }];
  const copy = JSON.stringify(nodes);
  const { entries } = flattenBookmarkTree(nodes);
  assert.deepEqual(entries, [{ url: 'https://example.com/a#part', title: 'A page', folderPath: ['Favorites', 'Read'], sourceId: '3', addedAt: 1700000000000 }]);
  assert.equal(JSON.stringify(nodes), copy);
});
test('invalid and excessively large imports fail before parsing', () => {
  assert.throws(() => parseBookmarkHtml('not a bookmark file'), /bookmark/i);
  assert.throws(() => parseBookmarkHtml('x'.repeat(8 * 1024 * 1024 + 1)), /large/i);
  assert.throws(() => flattenBookmarkTree({}), /bookmark/i);
  const deep = { title: 'deep', children: [] }; let next = deep;
  for (let i = 0; i < 30; i++) { const child = { title: 'next', children: [] }; next.children.push(child); next = child; }
  next.children.push({ url: 'https://example.com', title: 'hidden' });
  assert.throws(() => flattenBookmarkTree([deep]), /deep/i);
});


test('upload chunks respect encoded Unicode size as well as the bookmark count',async()=>{
  const { importChunk }=await import('../apps/extension/src/bookmark-import.js');
  const entries=Array.from({length:100},(_,index)=>({url:'https://example.com/'+index,title:'記'.repeat(500),description:'界'.repeat(2000),folderPath:Array(20).fill('語'.repeat(80))}));
  const first=importChunk(entries);assert.ok(first.length<100);assert.ok(Buffer.byteLength(JSON.stringify(first))<700*1024);
  const next=importChunk(entries,first.length);assert.equal(next[0].url,entries[first.length].url);
});
test('browser values stay literal and HTML entities are decoded exactly once',()=>{
 const url='https://example.com/?a=1&amp;foo=2';const title='A literal &amp; value';
 assert.equal(flattenBookmarkTree([{url,title}]).entries[0].url,url);assert.equal(flattenBookmarkTree([{url,title}]).entries[0].title,title);
 const html='<DL><DT><A HREF="https://example.com/?a=1&amp;amp;foo=2">A literal &amp;amp; value</A><DD>First note<DT><H3>Folder</H3><DD>Folder description<DL><DT><A HREF="https://other.example/">Second</A></DL></DL>';
 const first=parseBookmarkHtml(html).entries[0];assert.equal(first.url,url);assert.equal(first.title,title);assert.equal(first.description,'First note');
});
