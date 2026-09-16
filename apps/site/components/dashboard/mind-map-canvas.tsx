'use client';
import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import type ForceGraph from 'force-graph';
import {groupFor,type MindMapEdge,type MindMapNode,type MindMapSettings} from '../../lib/mind-map';
import {useTheme} from '../appearance/theme';

type GraphNode=MindMapNode&{x?:number;y?:number;fx?:number;fy?:number;degree:number;radius:number;color:string;order:number;short:string};
type GraphLink={id:string;kind:MindMapEdge['kind'];label:string;source:string|GraphNode;target:string|GraphNode};
type Graph=ForceGraph<GraphNode,GraphLink>;
export type MindMapCanvasHandle={zoomBy(factor:number):void;fit():void;animate():void};
type Props={nodes:MindMapNode[];edges:MindMapEdge[];settings:MindMapSettings;selected:string|null;fitKey:string;onSelect(id:string|null):void};

/** Obsidian-style palette: quiet grey saves, the brand emerald for tags, a white/near-black focus ring, links that only read at full strength when highlighted. */
function palette(dark:boolean){return dark
 ?{save:'#a4a8b0',tag:'#4cc38a',text:'#e8e9eb',textHalo:'#0f1011',link:'#4a4e57',tagLink:'#474c55',agent:'#9d9be6',hosted:'#74b3f3',manual:'#cfd2d8',focus:'#ffffff',ring:'#4cc38a'}
 :{save:'#8f8f8f',tag:'#0d7a50',text:'#262626',textHalo:'#fafafa',link:'#cfcfcf',tagLink:'#cdcdcd',agent:'#7475b9',hosted:'#237cb4',manual:'#5a5a5a',focus:'#111111',ring:'#0d7a50'};}
const hexAlpha=(hex:string,alpha:number)=>hex+Math.round(Math.max(0,Math.min(1,alpha))*255).toString(16).padStart(2,'0');
const endpoint=(value:string|GraphNode)=>typeof value==='string'?value:value.id;
const ease=(t:number)=>1-Math.pow(1-t,3);
const TIMELAPSE_MS=6000;

const MindMapCanvas=forwardRef<MindMapCanvasHandle,Props>(function MindMapCanvas({nodes,edges,settings,selected,fitKey,onSelect},ref){
 const {resolved}=useTheme(),dark=resolved==='dark';
 const container=useRef<HTMLDivElement>(null),graph=useRef<Graph|null>(null),index=useRef(new Map<string,GraphNode>()),topology=useRef(''),fitPending=useRef(true),interacted=useRef(false),timelapse=useRef(0);
 // Everything the per-frame accessors read lives in one ref so React re-renders never re-bind the renderer.
 const live=useRef({settings,selected,hovered:null as string|null,focus:null as string|null,neighbors:new Set<string>(),colors:palette(false),cutoff:Infinity,onSelect});
 live.current.settings=settings;live.current.onSelect=onSelect;
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
 const redraw=()=>graph.current?.nodeCanvasObject(graph.current.nodeCanvasObject());
 const refocus=()=>{const g=graph.current,s=live.current;s.focus=s.hovered||s.selected;s.neighbors=new Set();if(g&&s.focus)for(const link of g.graphData().links){const a=endpoint(link.source),b=endpoint(link.target);if(a===s.focus)s.neighbors.add(b);else if(b===s.focus)s.neighbors.add(a);}redraw();};
 const motion=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches?0:400;
 const fit=()=>{const g=graph.current,el=container.current;if(!g||!el||!g.graphData().nodes.length)return;const box=g.getGraphBbox(node=>node.order<=live.current.cutoff),w=box.x[1]-box.x[0],h=box.y[1]-box.y[0];const k=Math.max(.1,Math.min(2.4,Math.min((el.clientWidth-120)/Math.max(w,1),(el.clientHeight-140)/Math.max(h,1))));g.centerAt((box.x[0]+box.x[1])/2,(box.y[0]+box.y[1])/2,motion()).zoom(k,motion());};
 const zoomBy=(factor:number)=>{const g=graph.current;if(g)g.zoom(Math.min(10,Math.max(.1,g.zoom()*factor)),200);};
 const pan=(dx:number,dy:number)=>{const g=graph.current;if(!g)return;const c=g.centerAt(),k=g.zoom();g.centerAt(c.x+dx/k,c.y+dy/k,120);};
 const animate=()=>{
  const g=graph.current;if(!g)return;const orders=g.graphData().nodes.filter(node=>node.kind==='save').map(node=>node.order).filter(Number.isFinite);if(orders.length<2)return;
  const min=Math.min(...orders),max=Math.max(...orders);if(max<=min)return;const started=performance.now(),run=++timelapse.current;live.current.cutoff=min-1;g.d3ReheatSimulation();redraw();
  const step=(now:number)=>{if(run!==timelapse.current)return;const t=Math.min(1,(now-started)/TIMELAPSE_MS);live.current.cutoff=t>=1?Infinity:min+(max-min)*ease(t);redraw();if(t<1)requestAnimationFrame(step);};
  requestAnimationFrame(step);
 };
 useImperativeHandle(ref,()=>({zoomBy,fit,animate}));

 useEffect(()=>{
  const el=container.current;if(!el)return;let disposed=false,g:Graph|undefined,resize:ResizeObserver|undefined;
  void Promise.all([import('force-graph'),import('d3-force-3d')]).then(([{default:ForceGraph},{forceX,forceY}])=>{
   if(disposed)return;
   const s=live.current;
   const labelAlpha=(scale:number)=>Math.max(0,Math.min(1,(scale/s.settings.display.textFade-.85)/.45));
   const active=(id:string)=>!s.focus||id===s.focus||s.neighbors.has(id);
   const linkOn=(link:GraphLink)=>!s.focus||endpoint(link.source)===s.focus||endpoint(link.target)===s.focus;
   const linkBase=(link:GraphLink)=>link.kind==='tag'?s.colors.tagLink:s.colors[link.kind];
   const linkColor=(link:GraphLink)=>{const on=linkOn(link);return hexAlpha(on&&s.focus?(link.kind==='tag'?s.colors.ring:linkBase(link)):linkBase(link),s.focus?(on?.95:.06):link.kind==='tag'?.7:.85);};
   const visible=(id:string)=>(index.current.get(id)?.order??0)<=s.cutoff;
   g=new ForceGraph<GraphNode,GraphLink>(el)
    .backgroundColor('rgba(0,0,0,0)').nodeId('id').minZoom(.1).maxZoom(10).d3AlphaDecay(.028).d3VelocityDecay(.34).warmupTicks(40).cooldownTime(5000)
    .nodeCanvasObjectMode(()=>'replace')
    .nodeCanvasObject((node,ctx,scale)=>{
     const x=node.x||0,y=node.y||0,r=node.radius*s.settings.display.nodeSize,on=active(node.id),isFocus=node.id===s.focus;
     ctx.globalAlpha=on?1:.14;
     if(isFocus){ctx.beginPath();ctx.arc(x,y,r+4/scale,0,2*Math.PI);ctx.fillStyle=hexAlpha(s.colors.ring,.28);ctx.fill();}
     ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.fillStyle=isFocus?s.colors.focus:node.color;ctx.fill();
     const alpha=s.focus?(on?1:0):labelAlpha(scale);
     if(alpha>.02){ctx.globalAlpha=alpha;ctx.font=`${(on&&s.focus?11.5:11)/scale}px Inter,system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='top';ctx.lineWidth=3/scale;ctx.lineJoin='round';ctx.strokeStyle=s.colors.textHalo;ctx.strokeText(node.short,x,y+r+4/scale);ctx.fillStyle=s.colors.text;ctx.fillText(node.short,x,y+r+4/scale);}
     ctx.globalAlpha=1;
    })
    .nodePointerAreaPaint((node,color,ctx,scale)=>{ctx.beginPath();ctx.arc(node.x||0,node.y||0,Math.max(node.radius*s.settings.display.nodeSize,7/scale),0,2*Math.PI);ctx.fillStyle=color;ctx.fill();})
    .nodeVisibility(node=>node.order<=s.cutoff)
    .linkVisibility(link=>visible(endpoint(link.source))&&visible(endpoint(link.target)))
    .linkColor(linkColor)
    .linkWidth(link=>(link.kind==='tag'?.45:link.kind==='hosted'?.7:.9)*s.settings.display.linkWidth*(linkOn(link)&&s.focus?1.6:1))
    .linkLineDash(link=>link.kind==='hosted'?[2,2]:null)
    .linkDirectionalArrowLength(link=>s.settings.display.arrows&&link.kind!=='tag'?3.5*s.settings.display.nodeSize:0)
    .linkDirectionalArrowRelPos(1).linkDirectionalArrowColor(linkColor)
    .onNodeHover(node=>{s.hovered=node?.id||null;el.style.cursor=node?'pointer':'grab';refocus();})
    .onNodeClick(node=>s.onSelect(node.id))
    .onBackgroundClick(()=>s.onSelect(null))
    .onNodeDragEnd(node=>{node.fx=undefined;node.fy=undefined;})
    .onEngineStop(()=>{if(fitPending.current&&!interacted.current&&s.cutoff===Infinity){fitPending.current=false;fit();}});
   g.d3Force('x',forceX(0)).d3Force('y',forceY(0));
   graph.current=g;
   const mark=()=>{interacted.current=true;};el.addEventListener('pointerdown',mark);el.addEventListener('wheel',mark,{passive:true});
   resize=new ResizeObserver(entries=>{const box=entries[0]?.contentRect;if(g&&box)g.width(box.width).height(box.height);});resize.observe(el);
   g.width(el.clientWidth).height(el.clientHeight);
   setStatus('ready');
  }).catch(()=>{if(!disposed)setStatus('error');});
  return()=>{disposed=true;timelapse.current++;resize?.disconnect();g?._destructor();if(graph.current===g)graph.current=null;};
 },[]);

 // Forces read the settings live; a change just re-applies the numbers and reheats so the layout flows into place.
 useEffect(()=>{
  const g=graph.current;if(!g||status!=='ready')return;const f=settings.forces;
  g.d3Force('charge')?.strength(-(f.repel*14+2));
  g.d3Force('link')?.distance(f.distance).strength((link:GraphLink)=>f.link/Math.max(1,Math.min(typeof link.source==='object'?link.source.degree:1,typeof link.target==='object'?link.target.degree:1)));
  g.d3Force('x')?.strength(f.center*.14);g.d3Force('y')?.strength(f.center*.14);
  g.d3ReheatSimulation();
 },[settings.forces,status]);
 useEffect(()=>{if(status==='ready')redraw();},[settings.display,status]);

 // A new search or focus re-fits once its data lands; declared before the data effect so it never consumes a fit meant for the next topology.
 useEffect(()=>{fitPending.current=true;interacted.current=false;},[fitKey]);
 // Node objects survive across refreshes so positions are kept; the simulation only restarts when the topology changes.
 useEffect(()=>{
  const g=graph.current;if(!g||status!=='ready')return;
  const degree=new Map<string,number>(),earliest=new Map<string,number>();
  for(const edge of edges){degree.set(edge.source,(degree.get(edge.source)||0)+1);degree.set(edge.target,(degree.get(edge.target)||0)+1);}
  for(const node of nodes)if(node.kind==='save'&&node.createdAt)for(const edge of edges)if(edge.source===node.id&&edge.kind==='tag')earliest.set(edge.target,Math.min(earliest.get(edge.target)??Infinity,node.createdAt));
  const kept=new Map<string,GraphNode>();
  const list=nodes.map(node=>{
   const existing=index.current.get(node.id),d=degree.get(node.id)||0;
   const datum:GraphNode=Object.assign(existing||{} as GraphNode,node,{degree:d,radius:Math.min(13,(node.kind==='tag'?3.2:2.7)+Math.sqrt(d)*1.05),order:node.kind==='tag'?earliest.get(node.id)??0:node.createdAt??0,short:node.label.length>44?node.label.slice(0,42).trimEnd()+'…':node.label,color:''});
   kept.set(node.id,datum);return datum;
  });
  index.current=kept;
  const key=JSON.stringify([list.map(node=>node.id),edges.map(edge=>edge.id)]);
  if(key!==topology.current){topology.current=key;g.graphData({nodes:list,links:edges.map(edge=>({id:edge.id,kind:edge.kind,label:edge.label,source:edge.source,target:edge.target}))});if(fitPending.current)window.setTimeout(()=>{if(fitPending.current&&!interacted.current)fit();},450);}
  else redraw();
 },[nodes,edges,status]);

 useEffect(()=>{const s=live.current;s.colors=palette(dark);for(const node of index.current.values())node.color=groupFor(node,settings.groups)?.color||(node.kind==='tag'?s.colors.tag:s.colors.save);redraw();},[dark,settings.groups,nodes,status]);
 useEffect(()=>{
  live.current.selected=selected;refocus();
  const g=graph.current,el=container.current,node=selected?index.current.get(selected):null;
  if(!g||!el||!node||node.x===undefined||node.y===undefined)return;
  const p=g.graph2ScreenCoords(node.x,node.y);if(p.x<40||p.y<40||p.x>el.clientWidth-40||p.y>el.clientHeight-40)g.centerAt(node.x,node.y,motion());
 },[selected]);

 const onKeyDown=(event:React.KeyboardEvent)=>{
  const stepPx=event.shiftKey?160:40;
  const actions:Record<string,()=>void>={'+':()=>zoomBy(1.3),'=':()=>zoomBy(1.3),'-':()=>zoomBy(1/1.3),'0':fit,ArrowLeft:()=>pan(-stepPx,0),ArrowRight:()=>pan(stepPx,0),ArrowUp:()=>pan(0,-stepPx),ArrowDown:()=>pan(0,stepPx),Escape:()=>onSelect(null)};
  const action=actions[event.key];if(action){event.preventDefault();action();}
 };
 return <div className="mind-map-stage">
  <div className="mind-map-canvas" ref={container} tabIndex={0} role="application" aria-label="Interactive graph of saved items and tags. Drag nodes, pan and zoom. Use plus and minus to zoom, arrow keys to pan, or switch to List view." onKeyDown={onKeyDown} data-ready={status==='ready'}/>
  {status==='loading'?<p className="mind-map-stage-status" role="status">Arranging your connections…</p>:null}
  {status==='error'?<p className="mind-map-stage-status" role="alert">The map could not load. Use List view to explore your connections.</p>:null}
  <div className="mind-map-zoom" role="group" aria-label="Map zoom">
   <button type="button" aria-label="Zoom in" title="Zoom in (+)" disabled={status!=='ready'} onClick={()=>zoomBy(1.4)}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
   <button type="button" aria-label="Zoom out" title="Zoom out (−)" disabled={status!=='ready'} onClick={()=>zoomBy(1/1.4)}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button>
   <button type="button" aria-label="Fit map to screen" title="Fit to screen (0)" disabled={status!=='ready'} onClick={fit}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg></button>
  </div>
  <p className="mind-map-gesture-hint">Drag · Scroll to zoom · Hover to trace links</p>
 </div>;
});
export default MindMapCanvas;
