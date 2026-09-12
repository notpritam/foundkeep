import { moduleFail } from './customer-modules.ts';
export async function readBoundedText(response: Response | Request, max=256*1024) {
  if (Number(response.headers.get('content-length')||0)>max) moduleFail(413,'request_too_large','The request is too large.');
  const reader=response.body?.getReader(); if (!reader) return '';
  const chunks:Uint8Array[]=[]; let size=0; let timer:ReturnType<typeof setTimeout>|undefined;
  const timeout=new Promise<never>((_,reject) => { timer=setTimeout(() => reject(new Error('body_timeout')),15_000); });
  try {
    while (true) { const result=await Promise.race([reader.read(),timeout]); if (result.done) break; size+=result.value.byteLength;
      if (size>max) moduleFail(413,'request_too_large','The request is too large.'); chunks.push(result.value); }
    return Buffer.concat(chunks).toString('utf8');
  } finally { clearTimeout(timer); void reader.cancel().catch(() => {}); }
}
