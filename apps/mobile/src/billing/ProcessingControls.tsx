import {useEffect,useRef,useState} from 'react';
import {Alert,Switch,View} from 'react-native';
import {AdaptiveText as Text} from '../components/AdaptiveText.tsx';
import {FrostedPanel} from '../components/ScenicSurface.tsx';
import {Message} from '../components/ui.tsx';
import {useSession} from '../session/SessionProvider.tsx';
import {colors,typography} from '../theme.ts';
import type {AutomationState} from './types.ts';
export function ProcessingControls(){
 const {client,account}=useSession();const [settings,setSettings]=useState<AutomationState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const generation=useRef(0);
 useEffect(()=>{const current=++generation.current;setSettings(null);void client.automation().then(value=>{if(current===generation.current)setSettings(value);}).catch(()=>{});return()=>{generation.current++;};},[client,account?.id]);
 const update=async(value:Partial<AutomationState>,expected=generation.current)=>{if(expected!==generation.current||busy)return;setBusy(true);setError('');try{const next=await client.updateAutomation(value);if(expected===generation.current)setSettings(next);}catch(e){if(expected===generation.current)setError(e instanceof Error?e.message:'Preferences could not be saved.');}finally{if(expected===generation.current)setBusy(false);}};
 const change=(key:'enabled'|'fetchLinks'|'images',checked:boolean)=>{
  const expected=generation.current;
  if(checked&&(key==='enabled'||key==='images'))Alert.alert(key==='enabled'?'Organize your saves with OpenAI?':'Include images?',key==='enabled'?'Selected saved text, titles and source URLs will be sent to OpenAI for summaries, tags and connections. Originals and personal tags are preserved.':'Saved images and video previews can be sent to OpenAI to understand their contents.',[{text:'Cancel',style:'cancel'},{text:'Allow',onPress:()=>void update({[key]:checked,consentVersion:settings?.consentVersion},expected)}]);
  else void update({[key]:checked},expected);
 };
 if(!settings)return null;
 return <FrostedPanel><Text style={typography.heading}>Processing, on your terms.</Text><Text style={typography.small}>New saves are organized after you enable this. You can turn it off anytime.</Text>
  {([{key:'enabled',title:'Managed processing',detail:'Summaries, tags and related saves'},{key:'fetchLinks',title:'Read public links',detail:'Accessible articles and post metadata'},{key:'images',title:'Understand images',detail:'Share image and video previews with OpenAI'}] as const).map(item=><View key={item.key} style={{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:12}}><View style={{flex:1,gap:4}}><Text style={typography.label}>{item.title}</Text><Text style={typography.small}>{item.detail}</Text></View><Switch accessibilityLabel={item.title} value={settings[item.key]} disabled={busy||!settings.available||(!settings.pro&&!settings.enabled)||(item.key!=='enabled'&&!settings.enabled)} trackColor={{true:colors.accent}} onValueChange={value=>change(item.key,value)}/></View>)}
  <Text style={typography.small}>{settings.usage.used} used · {settings.usage.reserved} queued · {settings.usage.limit} credits this month.</Text>{!settings.available?<Text style={typography.small}>Managed processing is awaiting provider setup. Your free collection remains available.</Text>:null}<Message error>{error}</Message>
 </FrostedPanel>;
}
