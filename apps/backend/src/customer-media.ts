import {mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {resolveCustomerFile} from './customer-files.ts';
import {config} from './config.ts';
export type MediaDerivative={kind:'preview'|'compact';mime:string;data:Uint8Array};
export type MediaResult={text?:string;image?:{mime:string;base64:string};derivatives?:MediaDerivative[];note?:string};
type MediaSave={type:string;file_path:string|null;file_mime:string|null;file_bytes:number;blob_data:Uint8Array|null;blob_mime:string|null};
/** A fixed executable and argument list, bounded memory, CPU, output and wall time.
 * No shell, inherited secrets or network protocols are passed to a decoder. */
async function run(binary:string,args:string[],outputLimit=256_000):Promise<Uint8Array>{
 const executable=Bun.which(binary),limiter=Bun.which('prlimit');if(!executable||!limiter)throw new Error('Media tools are unavailable.');
 const child=Bun.spawn([limiter,'--as=1073741824','--cpu=40','--fsize=20971520','--nofile=64','--',executable,...args],{stdin:'ignore',stdout:'pipe',stderr:'ignore',env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1'}});
 const timer=setTimeout(()=>child.kill(9),45_000),chunks:Uint8Array[]=[];let size=0;
 try{
  const reader=child.stdout.getReader();
  try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>outputLimit)throw new Error('Media text is too large.');chunks.push(next.value);}}
  finally{reader.releaseLock();}
  if(await child.exited!==0)throw new Error('The media decoder could not finish.');return Buffer.concat(chunks);
 }finally{clearTimeout(timer);if(child.exitCode===null)child.kill(9);await child.exited;}
}
export async function processCustomerMedia(save:MediaSave,root=config.dataDir):Promise<MediaResult>{
 const mime=save.file_mime||save.blob_mime;
 if(!mime)return {};
 if(!['application/pdf','image/png','image/jpeg','image/webp','video/mp4','video/quicktime'].includes(mime))return {note:'This file format is preserved as an original; automatic media extraction is unavailable.'};
 const temporary=await mkdtemp(join(tmpdir(),'foundkeep-media-'));
 try{
  let input:string;
  if(save.file_path){input=resolveCustomerFile(root,save.file_path);const info=await stat(input);if(!info.isFile()||info.size>50*1024*1024)throw new Error('Invalid media file.');}
  else{if(!save.blob_data||save.blob_data.byteLength>8*1024*1024)throw new Error('Invalid media image.');input=join(temporary,'input');await writeFile(input,save.blob_data,{mode:0o600});}
  if(mime==='application/pdf'){
   const text=Buffer.from(await run('pdftotext',['-f','1','-l','32','-nopgbrk','-enc','UTF-8',input,'-'])).toString('utf8').trim().slice(0,100_000);
   return {text,note:'Searchable text extracted from up to the first 32 PDF pages. The complete original is preserved.'};
  }
  const video=mime.startsWith('video/');const demuxer=video?'mov':mime==='image/png'?'png_pipe':mime==='image/jpeg'?'jpeg_pipe':'webp_pipe';
  const inputArgs=['-hide_banner','-loglevel','error','-nostdin','-threads','1','-protocol_whitelist','file,pipe','-f',demuxer,...(video?['-enable_drefs','0']:[]),'-i',input];
  const preview=join(temporary,'preview.webp');
  await run('ffmpeg',[...inputArgs,'-map','0:v:0','-an','-frames:v','1','-vf','scale=960:960:force_original_aspect_ratio=decrease','-threads','1','-c:v','libwebp','-quality','76',preview]);
  const image=await readFile(preview);if(!image.byteLength||image.byteLength>1024*1024)throw new Error('The preview is too large.');
  const derivatives:MediaDerivative[]=[{kind:'preview',mime:'image/webp',data:image}];
  let note=video?'A preview was extracted from the video. Tags describe the preview and saved text, not a full video transcript.':'A resized preview was created. The original image is preserved.';
  if(video){
   const compact=join(temporary,'compact.mp4');
   try{
    await run('ffmpeg',[...inputArgs,'-map','0:v:0','-map','0:a:0?','-vf','scale=720:720:force_original_aspect_ratio=decrease:force_divisible_by=2','-c:v','libx264','-preset','veryfast','-crf','28','-threads','1','-c:a','aac','-b:a','96k','-movflags','+faststart',compact]);
    const data=await readFile(compact);if(data.byteLength>0&&data.byteLength<save.file_bytes&&data.byteLength<=20*1024*1024)derivatives.push({kind:'compact',mime:'video/mp4',data});
   }catch{note+=' A compact copy could not be completed within processing limits.';}
  }
  return {image:{mime:'image/webp',base64:image.toString('base64')},derivatives,note};
 }catch{return {note:'Media extraction could not finish. The original file is preserved.'};}
 finally{await rm(temporary,{recursive:true,force:true});}
}
