import { libraryRequest, getCloudStatus } from './cloud.js';
import { importChunk } from './bookmark-import.js';
const KEY='foundkeepBookmarkImport';let draining=null;let mutations=Promise.resolve();
function exclusive(action){const value=mutations.then(action,action);mutations=value.catch(()=>{});return value;}
const read=async()=> (await chrome.storage.local.get(KEY))[KEY]||null;
async function write(value){await chrome.storage.local.set({[KEY]:value});try{await chrome.runtime.sendMessage({kind:'atlas-import-changed'});}catch{}}
export async function importProgress(accountId){
  const job=await read();if(!job)return null;
  if(job.accountId!==accountId)return {otherAccount:true,status:'paused'};
  const {entries,...progress}=job;return {...progress,total:entries?.length||job.total||0};
}
export async function startBookmarkImport({accountId,source,entries}){
  if(!Array.isArray(entries)||entries.length>10_000||new TextEncoder().encode(JSON.stringify(entries)).length>8*1024*1024)throw new Error('Import at most 10,000 bookmarks or 8 MB at a time.');
  const state=await getCloudStatus();if(state.account?.id!==accountId||state.status==='reconnect')throw new Error('Connect the account receiving this import.');
  await exclusive(async()=>{
    const previous=await read();if(previous&&previous.status!=='complete')throw new Error('Finish or discard the previous import first.');
    await write({importId:crypto.randomUUID(),accountId,source,entries,chunk:0,offset:0,imported:0,duplicates:0,skipped:0,total:entries.length,status:'running',error:null});
  });
  void resumeBookmarkImport();return importProgress(accountId);
}
export async function cancelBookmarkImport(){return exclusive(async()=>{await write(null);});}
export function resumeBookmarkImport(){
  if(draining)return draining;
  draining=(async()=>{
    while(true){
      const job=await read();if(!job||job.status==='complete')return;
      const cloud=await getCloudStatus();if(cloud.account?.id!==job.accountId||cloud.status==='reconnect')return;
      if(job.offset>=job.entries.length){await exclusive(async()=>{const latest=await read();if(latest?.importId===job.importId)await write({...latest,status:'complete',entries:[]});});return;}
      try{
        const entries=importChunk(job.entries,job.offset);
        const result=await libraryRequest('import-chunk',{importId:job.importId,chunk:job.chunk,source:job.source,entries},job.accountId);
        await exclusive(async()=>{const latest=await read();if(latest?.importId!==job.importId)return;await write({...latest,offset:Math.min(job.offset+entries.length,job.total),chunk:job.chunk+1,imported:job.imported+result.imported,duplicates:job.duplicates+result.duplicates,skipped:job.skipped+result.skipped,status:'running',error:null});});
      }catch(error){await exclusive(async()=>{const latest=await read();if(latest?.importId===job.importId)await write({...latest,status:'paused',error:error.message||'The import paused. Try again when connected.'});});return;}
    }
  })().finally(()=>{draining=null;});return draining;
}
