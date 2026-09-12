import type {Database} from 'bun:sqlite';
import {moduleFail} from './customer-modules.ts';
export function customerChanges(db:Database,owner:string,after=0,limit=100){
 if(!Number.isSafeInteger(after)||after<0||!Number.isInteger(limit)||limit<1||limit>200)moduleFail(400,'invalid_cursor','Use a non-negative cursor and a limit from 1 to 200.');
 const floor=(db.query('SELECT seq FROM customer_change_floor WHERE account_id=?').get(owner) as {seq:number}|null)?.seq||0;
 const latest=(db.query('SELECT MAX(seq) seq FROM customer_changes WHERE account_id=?').get(owner) as {seq:number|null}).seq||floor;
 if(after<floor||after>latest)return {resetRequired:true,cursor:latest,changes:[],hasMore:false};
 const rows=db.query('SELECT seq,entity,entity_id AS id,operation,revision FROM customer_changes WHERE account_id=? AND seq>? ORDER BY seq LIMIT ?').all(owner,after,limit+1) as {seq:number;entity:string;id:string;operation:string;revision:number}[];
 const changes=rows.slice(0,limit);return {resetRequired:false,cursor:changes.at(-1)?.seq||after,changes,hasMore:rows.length>limit};
}
export function pruneCustomerChanges(db:Database){
 const owners=db.query('SELECT account_id FROM customer_changes GROUP BY account_id HAVING COUNT(*)>50000').all() as {account_id:string}[];
 for(const {account_id:owner} of owners)db.transaction(()=>{
  const floor=(db.query('SELECT seq FROM customer_changes WHERE account_id=? ORDER BY seq DESC LIMIT 1 OFFSET 49999').get(owner) as {seq:number}).seq-1;
  db.query('INSERT INTO customer_change_floor(account_id,seq) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET seq=MAX(seq,excluded.seq)').run(owner,floor);
  db.query('DELETE FROM customer_changes WHERE account_id=? AND seq<=?').run(owner,floor);
 }).immediate();
}
