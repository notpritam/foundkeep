'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {DEFAULT_SETTINGS,GROUP_COLORS,LINK_KINDS,RANGES,typeLabel,type MindMapSettings} from '../../lib/mind-map';

type Props={settings:MindMapSettings;types:string[];truncated?:{shown:number;matching:number};onChange(next:MindMapSettings):void;onAnimate():void;onClose():void};
type SectionKey='filters'|'groups'|'display'|'forces';

function Section({id,title,open,onToggle,children}:{id:SectionKey;title:string;open:boolean;onToggle():void;children:ReactNode}){
 return <section className="graph-section" data-open={open}><h3><button type="button" aria-expanded={open} aria-controls={'graph-section-'+id} onClick={onToggle}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>{title}</button></h3><div id={'graph-section-'+id} hidden={!open}>{children}</div></section>;
}
function Toggle({label,hint,checked,swatch,onChange}:{label:string;hint?:string;checked:boolean;swatch?:ReactNode;onChange(next:boolean):void}){
 return <div className="graph-row"><div className="graph-row-text">{swatch}<span>{label}</span>{hint?<small>{hint}</small>:null}</div><button type="button" role="switch" aria-checked={checked} aria-label={label} className="graph-switch" onClick={()=>onChange(!checked)}><span/></button></div>;
}
function Slider({label,hint,value,range,format,onChange}:{label:string;hint?:string;value:number;range:{min:number;max:number;step:number};format?(value:number):string;onChange(next:number):void}){
 const id='graph-slider-'+label.toLowerCase().replace(/\W+/g,'-');
 return <div className="graph-row graph-row-slider"><div className="graph-row-text"><label htmlFor={id}>{label}</label>{hint?<small>{hint}</small>:null}</div><output htmlFor={id}>{format?format(value):value}</output><input id={id} type="range" min={range.min} max={range.max} step={range.step} value={value} style={{'--fill':((value-range.min)/(range.max-range.min)*100).toFixed(1)+'%'} as React.CSSProperties} onChange={event=>onChange(Number(event.target.value))}/></div>;
}
function ColorDot({color,onChange}:{color:string;onChange(next:string):void}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
 return <div className="graph-color" ref={root}><button type="button" aria-label="Choose group colour" aria-expanded={open} style={{background:color}} onClick={()=>setOpen(value=>!value)}/>{open?<div className="graph-color-menu" role="group" aria-label="Group colours">{GROUP_COLORS.map(option=><button key={option} type="button" aria-label={option} aria-pressed={option===color} style={{background:option}} onClick={()=>{onChange(option);setOpen(false);}}/>)}<label className="graph-color-custom" title="Custom colour"><input type="color" value={color} onChange={event=>onChange(event.target.value)}/><span>Custom</span></label></div>:null}</div>;
}

export default function GraphSettingsPanel({settings,types,truncated,onChange,onAnimate,onClose}:Props){
 const [open,setOpen]=useState<Record<SectionKey,boolean>>({filters:true,groups:true,display:false,forces:false});
 const toggle=(key:SectionKey)=>setOpen(state=>({...state,[key]:!state[key]}));
 const patch=<K extends keyof MindMapSettings>(key:K,value:Partial<MindMapSettings[K]>)=>onChange({...settings,[key]:{...settings[key],...value}});
 const filters=settings.filters,display=settings.display,forces=settings.forces;
 return <aside className="graph-settings" aria-label="Graph settings" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();onClose();}}}>
  <header><h2>Graph settings</h2><div><button type="button" className="graph-icon-button" aria-label="Restore default settings" title="Restore default settings" onClick={()=>onChange(DEFAULT_SETTINGS)}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/></svg></button><button type="button" className="graph-icon-button" aria-label="Close graph settings" onClick={onClose}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div></header>
  <div className="graph-settings-body">
   <Section id="filters" title="Filters" open={open.filters} onToggle={()=>toggle('filters')}>
    <Toggle label="Tags" hint="Show tag nodes and the saves they connect" checked={filters.tags} swatch={<i className="graph-swatch" data-kind="tag"/>} onChange={tags=>patch('filters',{tags})}/>
    <Toggle label="Orphans" hint="Keep saves with no visible connections" checked={filters.orphans} onChange={orphans=>patch('filters',{orphans})}/>
    {types.length>1?<div className="graph-subgroup"><span className="graph-subgroup-title">Save types</span>{types.map(type=><Toggle key={type} label={typeLabel(type)} checked={filters.types[type]!==false} onChange={on=>patch('filters',{types:{...filters.types,[type]:on}})}/>)}</div>:null}
    <div className="graph-subgroup"><span className="graph-subgroup-title">Links between saves</span>{LINK_KINDS.map(item=><Toggle key={item.kind} label={item.label} hint={item.hint} checked={filters.links[item.kind]} swatch={<i className="graph-swatch" data-kind={item.kind}/>} onChange={on=>patch('filters',{links:{...filters.links,[item.kind]:on}})}/>)}</div>
    {truncated?<p className="graph-note">Showing the {truncated.shown} most recent of {truncated.matching} saves. Search to reach older ones.</p>:null}
   </Section>
   <Section id="groups" title="Groups" open={open.groups} onToggle={()=>toggle('groups')}>
    {settings.groups.length?<ul className="graph-groups">{settings.groups.map(group=><li key={group.id}><ColorDot color={group.color} onChange={color=>onChange({...settings,groups:settings.groups.map(item=>item.id===group.id?{...item,color}:item)})}/><input type="text" maxLength={100} placeholder="title, tag:name or type:note" aria-label="Group search" value={group.query} onChange={event=>onChange({...settings,groups:settings.groups.map(item=>item.id===group.id?{...item,query:event.target.value}:item)})}/><button type="button" className="graph-icon-button" aria-label="Remove group" onClick={()=>onChange({...settings,groups:settings.groups.filter(item=>item.id!==group.id)})}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></li>)}</ul>:<p className="graph-note">Colour saves that match a search. Try <code>tag:research</code>, <code>type:note</code> or any word from a title.</p>}
    <button type="button" className="graph-add" disabled={settings.groups.length>=20} onClick={()=>onChange({...settings,groups:[...settings.groups,{id:crypto.randomUUID(),query:'',color:GROUP_COLORS[settings.groups.length%GROUP_COLORS.length]}]})}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>New group</button>
   </Section>
   <Section id="display" title="Display" open={open.display} onToggle={()=>toggle('display')}>
    <Toggle label="Arrows" hint="Point links from a save to the item it links to" checked={display.arrows} onChange={arrows=>patch('display',{arrows})}/>
    <Slider label="Text fade threshold" hint="Higher hides titles until you zoom in further" value={display.textFade} range={RANGES.textFade} format={value=>value.toFixed(2)} onChange={textFade=>patch('display',{textFade})}/>
    <Slider label="Node size" value={display.nodeSize} range={RANGES.nodeSize} format={value=>value.toFixed(2)+'×'} onChange={nodeSize=>patch('display',{nodeSize})}/>
    <Slider label="Link thickness" value={display.linkWidth} range={RANGES.linkWidth} format={value=>value.toFixed(2)+'×'} onChange={linkWidth=>patch('display',{linkWidth})}/>
    <div className="graph-row"><div className="graph-row-text"><span>Animate</span><small>Replay your saves in the order you added them</small></div><button type="button" className="graph-play" onClick={onAnimate}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Play</button></div>
   </Section>
   <Section id="forces" title="Forces" open={open.forces} onToggle={()=>toggle('forces')}>
    <Slider label="Center force" hint="Higher pulls everything into a rounder cluster" value={forces.center} range={RANGES.center} format={value=>value.toFixed(2)} onChange={center=>patch('forces',{center})}/>
    <Slider label="Repel force" hint="How strongly nodes push each other apart" value={forces.repel} range={RANGES.repel} format={value=>value.toFixed(1)} onChange={repel=>patch('forces',{repel})}/>
    <Slider label="Link force" hint="How tightly linked nodes hold together" value={forces.link} range={RANGES.link} format={value=>value.toFixed(2)} onChange={link=>patch('forces',{link})}/>
    <Slider label="Link distance" value={forces.distance} range={RANGES.distance} format={value=>String(Math.round(value))} onChange={distance=>patch('forces',{distance})}/>
   </Section>
  </div>
 </aside>;
}
