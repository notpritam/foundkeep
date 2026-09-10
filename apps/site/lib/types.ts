export interface Account { id:string; email:string; name:string; createdAt:number; hasPassword?:boolean }
export interface Connection { id:string; name:string; clientKind?:'mobile'|'browser'|'unknown'; createdAt:number; lastSeenAt:number|null }
export interface Usage { captures:number; bytes:number; maxCaptures:number; maxBytes:number }
export interface Me { account:Account; connections:Connection[]; usage:Usage }
