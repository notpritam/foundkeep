import {createHash} from 'node:crypto';
import {isIP} from 'node:net';
import {parseHTML} from 'linkedom';
import {previewSourceUrl,isPublicPreviewAddress,resolvePublicHost,requestPinned,type PreviewAddress,type PreviewTarget,type PreviewUpstream} from './customer-preview.ts';
export type SourceSnapshot={url:string;requestedUrl:string;fetchedAt:number;contentHash:string;text:string;title:string|null;description:string|null;imageUrl:string|null;author:string|null;publishedAt:string|null;siteName:string|null};
const cleaned=(value:string|null|undefined,max:number)=>value?.replace(/\s+/g,' ').trim().slice(0,max)||null;
export function extractSource(html:string,url:string):Omit<SourceSnapshot,'requestedUrl'|'fetchedAt'|'contentHash'>{
  const {document}=parseHTML(html);
  const meta=(name:string)=>document.querySelector(`meta[property="${name}"],meta[name="${name}"]`)?.getAttribute('content');
  const title=cleaned(meta('og:title')||document.querySelector('title')?.textContent,1000);
  const description=cleaned(meta('og:description')||meta('description'),2000);
  const image=meta('og:image')||meta('twitter:image');let imageUrl:string|null=null;
  try{imageUrl=image?previewSourceUrl(new URL(image,url).href)?.href||null:null;}catch{}
  const author=cleaned(meta('author')||meta('article:author'),200),publishedAt=cleaned(meta('article:published_time'),100),siteName=cleaned(meta('og:site_name'),200);
  document.querySelectorAll('script,style,nav,footer,header,aside,noscript,iframe,form,svg').forEach((node:{remove():void})=>node.remove());
  const root=document.querySelector('article')||document.querySelector('main')||document.body;
  const paragraphs=Array.from(root?.querySelectorAll('h1,h2,h3,p,li,blockquote,pre')||[]).map(node=>cleaned((node as {textContent:string|null}).textContent,5000)).filter(Boolean);
  const text=(paragraphs.length?paragraphs.join('\n\n'):cleaned(root?.textContent,100_000)||description||'').slice(0,100_000);
  return {url,text,title,description,imageUrl,author,publishedAt,siteName};
}
export function createSourceFetcher(options:{resolve?:(host:string,signal:AbortSignal)=>Promise<PreviewAddress[]>;transport?:(target:PreviewTarget,signal:AbortSignal,accept?:string)=>Promise<PreviewUpstream>}={}){
 return async(raw:string):Promise<SourceSnapshot>=>{
  let url=previewSourceUrl(raw);if(!url)throw new Error('This source is not a public web page.');
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;let current:PreviewUpstream|undefined;
  const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('The source took too long to respond.'));},12_000);});
  try{
   for(let hop=0;hop<4;hop++){
    const host=url.hostname.replace(/^\[|\]$/g,'');const family=isIP(host);
    const addresses:PreviewAddress[]=family?[{address:host,family:family as 4|6}]:await Promise.race([(options.resolve||resolvePublicHost)(host,controller.signal),timeout]);
    if(!addresses.length||addresses.some(item=>!isPublicPreviewAddress(item.address)))throw new Error('This source is not a public web page.');
    current=await Promise.race([(options.transport||requestPinned)({...addresses[0]!,url},controller.signal,'text/html,application/xhtml+xml'),timeout]);
    if([301,302,303,307,308].includes(current.status)){
      const next=current.headers.get('location');current.cancel();if(!next)throw new Error('The source redirected without a destination.');url=previewSourceUrl(new URL(next,url).href);if(!url)throw new Error('The source redirected to an unsupported address.');continue;
    }
    if(current.status!==200||!/^text\/html|^application\/xhtml\+xml/.test(current.headers.get('content-type')||'')||!['identity',''].includes(current.headers.get('content-encoding')||''))throw new Error('This source does not expose a readable public page.');
    if(Number(current.headers.get('content-length')||0)>2*1024*1024)throw new Error('This source is too large to process.');
    const chunks:Uint8Array[]=[];let bytes=0;const iterator=current.body[Symbol.asyncIterator]();
    while(true){const item=await Promise.race([iterator.next(),timeout]);if(item.done)break;bytes+=item.value.byteLength;if(bytes>2*1024*1024)throw new Error('This source is too large to process.');chunks.push(item.value);}
    const body=Buffer.concat(chunks);return {...extractSource(body.toString('utf8'),url.href),requestedUrl:raw,fetchedAt:Date.now(),contentHash:createHash('sha256').update(body).digest('hex')};
   }
   throw new Error('The source redirected too many times.');
  }finally{clearTimeout(timer);controller.abort();current?.cancel();}
 };
}
export const fetchCustomerSource=createSourceFetcher();
