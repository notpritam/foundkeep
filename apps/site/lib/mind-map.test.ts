import {expect,test} from 'bun:test';
import {applyFilters,DEFAULT_SETTINGS,groupFor,matchesQuery,normalizeSettings,type MindMapEdge,type MindMapNode} from './mind-map';
const save=(id:string,extra:Partial<MindMapNode>={}):MindMapNode=>({id:'save:'+id,kind:'save',label:'Save '+id,saveId:id,type:'bookmark',tags:[],...extra});
const tag=(name:string):MindMapNode=>({id:'tag:'+name,kind:'tag',label:name});
const edge=(source:string,target:string,kind:MindMapEdge['kind']='tag'):MindMapEdge=>({id:`${kind}:${source}:${target}`,source,target,kind,label:kind});
test('normalizeSettings fills defaults, clamps ranges and drops junk',()=>{
 expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
 const fixed=normalizeSettings({display:{nodeSize:99,textFade:'x'},forces:{repel:-5},groups:[{query:'a',color:'red'},{id:'ok',query:'b',color:'#ff0000'},'junk'],filters:{types:{note:false,bad:'no'},links:{agent:false}}});
 expect(fixed.display.nodeSize).toBe(3);expect(fixed.display.textFade).toBe(DEFAULT_SETTINGS.display.textFade);expect(fixed.forces.repel).toBe(0);
 expect(fixed.groups).toHaveLength(2);expect(fixed.groups[0].color).toBe('#5b9cf6');expect(fixed.groups[1]).toEqual({id:'ok',query:'b',color:'#ff0000'});
 expect(fixed.filters.types).toEqual({note:false});expect(fixed.filters.links).toEqual({agent:false,hosted:true,manual:true});
});
test('group queries match titles, tags, tag:/type: scopes and negation',()=>{
 const node=save('1',{label:'Rust async book',type:'note',tags:['Rust','Reading']});
 expect(matchesQuery(node,'rust')).toBe(true);expect(matchesQuery(node,'reading')).toBe(true);expect(matchesQuery(node,'tag:rust')).toBe(true);expect(matchesQuery(node,'tag:rus')).toBe(false);
 expect(matchesQuery(node,'type:note')).toBe(true);expect(matchesQuery(node,'type:bookmark')).toBe(false);expect(matchesQuery(node,'rust -async')).toBe(false);expect(matchesQuery(node,'')).toBe(false);
 expect(matchesQuery(tag('Rust'),'tag:rust')).toBe(true);expect(matchesQuery(tag('Rust'),'type:tag')).toBe(true);
 expect(groupFor(node,[{id:'a',query:'   ',color:'#000000'},{id:'b',query:'rust',color:'#111111'}])?.id).toBe('b');
});
test('filters drop hidden kinds with their edges, then orphans only when asked',()=>{
 const data={nodes:[save('a'),save('b',{type:'note'}),save('c'),tag('x')],edges:[edge('save:a','tag:x'),edge('save:b','tag:x'),edge('save:a','save:c','agent')]};
 const all=applyFilters(data,DEFAULT_SETTINGS.filters);expect(all.nodes).toHaveLength(4);expect(all.edges).toHaveLength(3);
 const noTags=applyFilters(data,{...DEFAULT_SETTINGS.filters,tags:false});expect(noTags.nodes.map(n=>n.id)).toEqual(['save:a','save:b','save:c']);expect(noTags.edges).toHaveLength(1);
 const noTagsNoOrphans=applyFilters(data,{...DEFAULT_SETTINGS.filters,tags:false,orphans:false});expect(noTagsNoOrphans.nodes.map(n=>n.id)).toEqual(['save:a','save:c']);
 const noNotes=applyFilters(data,{...DEFAULT_SETTINGS.filters,types:{note:false}});expect(noNotes.nodes.some(n=>n.id==='save:b')).toBe(false);expect(noNotes.edges).toHaveLength(2);
 const noAgent=applyFilters(data,{...DEFAULT_SETTINGS.filters,links:{agent:false,hosted:true,manual:true},orphans:false});expect(noAgent.nodes.map(n=>n.id)).toEqual(['save:a','save:b','tag:x']);
});
