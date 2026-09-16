'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {useEffect,useMemo,useRef,useState} from 'react';
import {keepPreviousData,useQuery} from '@tanstack/react-query';
import {useDashboard} from './context';
import {ThemeControl} from '../appearance/theme';
import {SectionLoading,RefreshIcon,Spinner} from './loading';
import GraphSettingsPanel from './mind-map-settings';
import type {MindMapCanvasHandle} from './mind-map-canvas';
import {applyFilters,DEFAULT_SETTINGS,loadSettings,saveSettings,saveTypes,type MindMapData,type MindMapNode,type MindMapSettings as Settings} from '../../lib/mind-map';
import './mind-map.css';
const Canvas=dynamic(()=>import('./mind-map-canvas'),{ssr:false,loading:()=> <SectionLoading label="Opening the interactive map…"/>});
const plural=(count:number,word:string)=>`${count} ${word}${count===1?'':'s'}`;

export default function MindMap(){
 const {me,request}=useDashboard();
 const [input,setInput]=useState(''),[query,setQuery]=useState(''),[focus,setFocus]=useState(''),[view,setView]=useState<'graph'|'list'>('graph'),[selected,setSelected]=useState<string|null>(null),[panel,setPanel]=useState<'settings'|null>(null);
 // Settings start from defaults so the server and first client render agree, then localStorage wins.
 const [settings,setSettingsState]=useState<Settings>(DEFAULT_SETTINGS),loaded=useRef(false);
 useEffect(()=>{setSettingsState(loadSettings());loaded.current=true;},[]);
 const setSettings=(next:Settings)=>{setSettingsState(next);if(loaded.current)saveSettings(next);};
 useEffect(()=>{const timer=window.setTimeout(()=>setQuery(input.trim()),300);return()=>window.clearTimeout(timer);},[input]);
 const canvas=useRef<MindMapCanvasHandle>(null);
 const graph=useQuery({queryKey:['mind-map',me.account.id,query,focus],queryFn:({signal})=>request<MindMapData>('/graph?'+new URLSearchParams({q:query,...(focus?{focus}:{})}),{signal}),placeholderData:keepPreviousData,refetchInterval:15_000,refetchIntervalInBackground:false});
 const data=graph.data;
 const visible=useMemo(()=>data?applyFilters(data,settings.filters):{nodes:[],edges:[]},[data,settings.filters]);
 const types=useMemo(()=>data?saveTypes(data.nodes):[],[data]);
 const current=data?.nodes.find(node=>node.id===selected),saves=data?.nodes.filter(node=>node.kind==='save')||[];
 const linked=current?data?.edges.filter(edge=>edge.source===current.id||edge.target===current.id).map(edge=>({node:data.nodes.find(node=>node.id===(edge.source===current.id?edge.target:edge.source)),label:edge.label})).filter((item):item is {node:MindMapNode;label:string}=>Boolean(item.node)):[];
 const focused=focus?data?.nodes.find(node=>node.saveId===focus):undefined;
 const clear=()=>{setInput('');setQuery('');setFocus('');setSelected(null);};
 const select=(id:string|null)=>{setSelected(id);if(id)setPanel(null);};
 const stats=data?[plural(visible.nodes.filter(node=>node.kind==='save').length,'save'),settings.filters.tags?plural(visible.nodes.length-visible.nodes.filter(node=>node.kind==='save').length,'tag'):null,plural(visible.edges.length,'link')].filter(Boolean).join(' · '):'Your saves, connected.';
 return <div className="mind-map-page" data-panel={panel||(current?'inspector':'none')}>
  <header className="mind-map-heading"><div><h1>Mind map</h1><p aria-live="polite">{stats}</p></div><ThemeControl compact/></header>
  <div className="mind-map-toolbar">
   <form role="search" onSubmit={event=>{event.preventDefault();setQuery(input.trim());}}><label className="sr-only" htmlFor="mind-map-search">Search your mind map</label><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="mind-map-search" type="search" maxLength={100} placeholder="Search saves, tags, or ideas…" value={input} onChange={event=>setInput(event.target.value)}/>{graph.isFetching&&graph.isPlaceholderData?<Spinner/>:input?<button type="button" className="mind-map-clear" aria-label="Clear search" onClick={()=>{setInput('');setQuery('');}}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>:null}</form>
   {focus?<button type="button" className="mind-map-chip" onClick={()=>setFocus('')} title="Show the whole map"><span>Focused on</span>{focused?.label||'one save'}<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>:null}
   <div className="mind-map-view" role="group" aria-label="Mind map view"><button type="button" aria-pressed={view==='graph'} onClick={()=>setView('graph')}>Graph</button><button type="button" aria-pressed={view==='list'} onClick={()=>setView('list')}>List</button></div>
   <button className="mind-map-icon-button" type="button" aria-label="Refresh mind map" title="Refresh" disabled={graph.isFetching} onClick={()=>void graph.refetch()}>{graph.isFetching?<Spinner/>:<RefreshIcon active={false}/>}</button>
   <button className="mind-map-icon-button" type="button" aria-label="Graph settings" aria-pressed={panel==='settings'} title="Filters, groups, display and forces" onClick={()=>{setPanel(panel==='settings'?null:'settings');setSelected(null);}}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg></button>
  </div>
  {graph.isError?<div className="mind-map-error" role="alert"><p>{graph.error.message}</p><button className="button secondary" onClick={()=>void graph.refetch()}>Retry map</button></div>:null}
  {graph.isPending?<SectionLoading label="Finding your connections…"/>:data&&!saves.length?<section className="mind-map-empty"><h2>{query||focus?'No saves match yet.':'Your next connection starts with a save.'}</h2><p>{query||focus?'Try another word or open your full mind map.':'Save a link or note, add tags, or connect your agent to start building a map of your ideas.'}</p><div>{query||focus?<button className="button secondary" onClick={clear}>Show all saves</button>:<><Link className="button primary" href="/dashboard">Open my library</Link><Link className="button secondary" href="/dashboard/agents">Connect an agent</Link></>}</div></section>:data?
   <div className="mind-map-content">
    <section aria-label={view==='graph'?'Your connections':'Saved items in your map'} className="mind-map-visual">{view==='graph'?<Canvas ref={canvas} nodes={visible.nodes} edges={visible.edges} settings={settings} selected={selected} fitKey={query+'|'+focus} onSelect={select}/>:<ul className="mind-map-list">{saves.map(node=><li key={node.id}><button type="button" aria-label={'Inspect '+node.label} aria-pressed={selected===node.id} onClick={()=>select(node.id)}><span>{node.type}</span><strong>{node.label}</strong><small>{node.tags?.length?node.tags.join(' · '):'No tags yet'}</small></button></li>)}</ul>}</section>
    {panel==='settings'?<GraphSettingsPanel settings={settings} types={types} truncated={data.truncated?{shown:data.shownSaves,matching:data.matchingSaves}:undefined} onChange={setSettings} onAnimate={()=>{setView('graph');canvas.current?.animate();}} onClose={()=>setPanel(null)}/>:null}
    <aside className="mind-map-inspector" aria-label="Selected connection" hidden={!current||panel==='settings'}>{current?<><div className="mind-map-inspector-top"><span>{current.kind==='tag'?'Tag':current.type||'Saved item'}</span><button type="button" className="graph-icon-button" aria-label="Clear selection" onClick={()=>setSelected(null)}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><h2>{current.label}</h2>{current.summary?<p>{current.summary}</p>:null}{current.kind==='save'?<><div className="mind-map-tags">{current.tags?.map(tag=><span key={tag}>{tag}</span>)}</div><Link className="button primary" href={'/dashboard/saved/'+current.saveId}>Open saved item</Link><div className="mind-map-inspector-actions"><button className="subtle-button" onClick={()=>{setFocus(current.saveId||'');setQuery('');setInput('');}}>Focus its connections</button>{current.sourceUrl?<a className="subtle-button" href={current.sourceUrl} target="_blank" rel="noopener noreferrer">Visit source ↗</a>:null}</div></>:null}<h3>Connected here <span>{linked?.length||0}</span></h3>{linked?.length?<ul className="mind-map-related">{linked.map((item,index)=><li key={item.node.id+index}><button type="button" onClick={()=>select(item.node.id)}><span>{item.label}</span><strong>{item.node.label}</strong></button></li>)}</ul>:<p>No visible connections yet. Your agent can use link_saves to attach a related item.</p>}</>:null}</aside>
   </div>:null}
 </div>;
}
