export type MindMapNode={id:string;kind:'save'|'tag';label:string;saveId?:string;type?:string;sourceUrl?:string|null;summary?:string|null;tags?:string[];revision?:number;createdAt?:number};
export type MindMapEdge={id:string;source:string;target:string;kind:'tag'|'agent'|'hosted'|'manual';label:string};
export type MindMapData={nodes:MindMapNode[];edges:MindMapEdge[];totalSaves:number;matchingSaves:number;shownSaves:number;truncated:boolean;totalTags:number;shownTags:number;focus:string|null;query:string};

export type MindMapLinkKind=Exclude<MindMapEdge['kind'],'tag'>;
export type MindMapGroup={id:string;query:string;color:string};
export type MindMapSettings={
 filters:{tags:boolean;orphans:boolean;types:Record<string,boolean>;links:Record<MindMapLinkKind,boolean>};
 groups:MindMapGroup[];
 display:{arrows:boolean;textFade:number;nodeSize:number;linkWidth:number};
 forces:{center:number;repel:number;link:number;distance:number};
};
export const SETTINGS_KEY='fk-mind-map-settings';
export const GROUP_COLORS=['#5b9cf6','#b76ef5','#f4923d','#ef5a6f','#e0b62c','#22b3b3','#ee6fb0','#8a8f98'];
export const LINK_KINDS:{kind:MindMapLinkKind;label:string;hint:string}[]=[{kind:'agent',label:'Agent links',hint:'Linked by your agent'},{kind:'hosted',label:'Processing suggestions',hint:'Suggested while processing'},{kind:'manual',label:'Your links',hint:'Linked by you'}];
export const RANGES={textFade:{min:.3,max:3,step:.05},nodeSize:{min:.4,max:3,step:.05},linkWidth:{min:.2,max:4,step:.05},center:{min:0,max:1,step:.01},repel:{min:0,max:20,step:.25},link:{min:0,max:1,step:.01},distance:{min:20,max:300,step:5}} as const;
export const DEFAULT_SETTINGS:MindMapSettings={filters:{tags:true,orphans:true,types:{},links:{agent:true,hosted:true,manual:true}},groups:[],display:{arrows:false,textFade:1.35,nodeSize:1,linkWidth:1},forces:{center:.5,repel:8,link:.6,distance:60}};

const clamp=(value:unknown,range:{min:number;max:number},fallback:number)=>typeof value==='number'&&Number.isFinite(value)?Math.min(range.max,Math.max(range.min,value)):fallback;
const bool=(value:unknown,fallback:boolean)=>typeof value==='boolean'?value:fallback;
const isRecord=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
/** Rebuilds a settings object from untrusted storage so a stale or hand-edited entry can never break the map. */
export function normalizeSettings(raw:unknown):MindMapSettings{
 const input=isRecord(raw)?raw:{},filters=isRecord(input.filters)?input.filters:{},display=isRecord(input.display)?input.display:{},forces=isRecord(input.forces)?input.forces:{},links=isRecord(filters.links)?filters.links:{},types=isRecord(filters.types)?filters.types:{};
 const d=DEFAULT_SETTINGS;
 return {
  filters:{tags:bool(filters.tags,d.filters.tags),orphans:bool(filters.orphans,d.filters.orphans),types:Object.fromEntries(Object.entries(types).filter(([,value])=>typeof value==='boolean').slice(0,32)) as Record<string,boolean>,links:{agent:bool(links.agent,true),hosted:bool(links.hosted,true),manual:bool(links.manual,true)}},
  groups:(Array.isArray(input.groups)?input.groups:[]).filter(isRecord).map(group=>({id:typeof group.id==='string'?group.id.slice(0,40):crypto.randomUUID(),query:typeof group.query==='string'?group.query.slice(0,100):'',color:typeof group.color==='string'&&/^#[0-9a-f]{6}$/i.test(group.color)?group.color:GROUP_COLORS[0]})).slice(0,20),
  display:{arrows:bool(display.arrows,d.display.arrows),textFade:clamp(display.textFade,RANGES.textFade,d.display.textFade),nodeSize:clamp(display.nodeSize,RANGES.nodeSize,d.display.nodeSize),linkWidth:clamp(display.linkWidth,RANGES.linkWidth,d.display.linkWidth)},
  forces:{center:clamp(forces.center,RANGES.center,d.forces.center),repel:clamp(forces.repel,RANGES.repel,d.forces.repel),link:clamp(forces.link,RANGES.link,d.forces.link),distance:clamp(forces.distance,RANGES.distance,d.forces.distance)},
 };
}
export function loadSettings():MindMapSettings{try{return normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY)||''));}catch{return normalizeSettings(null);}}
export function saveSettings(settings:MindMapSettings){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{}}

const fold=(value:string)=>value.trim().toLowerCase();
/** Group queries: space-separated terms, all must match. `tag:x` / `type:x` scope a term; `-term` excludes; plain terms search the title and tags. */
export function matchesQuery(node:MindMapNode,query:string):boolean{
 const terms=fold(query).split(/\s+/).filter(Boolean);if(!terms.length)return false;
 const label=fold(node.label),tags=(node.tags||[]).map(fold),type=fold(node.type||(node.kind==='tag'?'tag':''));
 return terms.every(raw=>{
  const negate=raw.startsWith('-'),term=negate?raw.slice(1):raw;if(!term)return true;
  let hit:boolean;
  if(term.startsWith('tag:'))hit=node.kind==='tag'?label===term.slice(4):tags.includes(term.slice(4));
  else if(term.startsWith('type:'))hit=type===term.slice(5);
  else hit=label.includes(term)||tags.some(tag=>tag.includes(term));
  return negate?!hit:hit;
 });
}
export const groupFor=(node:MindMapNode,groups:MindMapGroup[])=>groups.find(group=>group.query.trim()&&matchesQuery(node,group.query))||null;

/** Applies Filters to the loaded graph: hidden tags/link kinds drop their edges, then orphans are removed only if the setting asks. */
export function applyFilters(data:Pick<MindMapData,'nodes'|'edges'>,filters:MindMapSettings['filters']):{nodes:MindMapNode[];edges:MindMapEdge[]}{
 const visibleType=(node:MindMapNode)=>node.kind==='tag'?filters.tags:filters.types[node.type||'other']!==false;
 let nodes=data.nodes.filter(visibleType);
 const ids=new Set(nodes.map(node=>node.id));
 const edges=data.edges.filter(edge=>ids.has(edge.source)&&ids.has(edge.target)&&(edge.kind==='tag'?filters.tags:filters.links[edge.kind]));
 if(!filters.orphans){const linked=new Set<string>();for(const edge of edges){linked.add(edge.source);linked.add(edge.target);}nodes=nodes.filter(node=>linked.has(node.id));}
 return {nodes,edges};
}
export const saveTypes=(nodes:MindMapNode[])=>[...new Set(nodes.filter(node=>node.kind==='save').map(node=>node.type||'other'))].sort();
export const typeLabel=(type:string)=>({bookmark:'Bookmarks',link:'Links',note:'Notes',selection:'Highlights',image:'Images',file:'Files',other:'Other'} as Record<string,string>)[type]||type.charAt(0).toUpperCase()+type.slice(1);
