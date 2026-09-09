import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://preview');
  if(req.method==='POST'&&url.pathname==='/choice'){
   let body='';for await(const chunk of req){body+=chunk;if(body.length>300){res.writeHead(413).end();return;}}
   const value=JSON.parse(body);if(!['Floating dock','Edge bar','Search dock'].includes(value.variant)||!['purple','red'].includes(value.palette))throw Error();
   await writeFile('/tmp/foundkeep-chrome-choice.json',JSON.stringify({variant:value.variant,palette:value.palette,at:new Date().toISOString()}),{mode:0o600});res.writeHead(204).end();return;
  }
  const requested=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
  const file=path.resolve(root,requested);
  if(!file.startsWith(root+path.sep)||!types[path.extname(file)]||requested==='serve.mjs')throw Error();
  res.writeHead(200,{'content-type':types[path.extname(file)],'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(await readFile(file));
 }catch{res.writeHead(404).end('Not found');}
}).listen(8926,'0.0.0.0',()=>console.log('Foundkeep chrome preview on 8926'));
