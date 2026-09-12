import {expect,test} from 'bun:test';
import {processCustomerMedia} from '../src/customer-media.ts';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
test('unsupported media stays intact without invoking a decoder',async()=>{
 expect(await processCustomerMedia({type:'file',file_path:null,file_mime:'application/octet-stream',file_bytes:5,blob_data:null,blob_mime:null})).toMatchObject({note:expect.stringContaining('original')});
});
test('a real video receives a bounded preview and a compact copy without changing its original',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'foundkeep-media-test-'));
 try{
  const output=join(dir,'original.mp4');const child=Bun.spawn(['/usr/bin/ffmpeg','-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc=size=960x720:rate=12','-t','1','-c:v','libx264','-threads','1','-pix_fmt','yuv420p',output],{stdout:'ignore',stderr:'ignore'});expect(await child.exited).toBe(0);
  const original=await readFile(output);const root=join(dir,'customer-files');await import('node:fs/promises').then(fs=>fs.mkdir(root));await import('node:fs/promises').then(fs=>fs.copyFile(output,join(root,'sample')));
  const result=await processCustomerMedia({type:'video',file_path:'customer-files/sample',file_mime:'video/mp4',file_bytes:original.byteLength,blob_data:null,blob_mime:null},dir);
  expect(result.derivatives?.some(item=>item.kind==='preview'&&item.mime==='image/webp')).toBe(true);expect(result.image?.base64.length).toBeLessThan(1_500_000);expect(await readFile(output)).toEqual(original);expect(result.note).toContain('not a full video transcript');
 }finally{await rm(dir,{recursive:true,force:true});}
},60_000);
