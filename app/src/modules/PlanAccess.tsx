import {useEffect,useRef,useState} from 'react'
import {getModuleScopes,saveModuleScope} from '../api'
import type {ModuleScopeReply} from '../api'
import type {ModuleVisibility} from '../../../platform/companyModules'
import {ErrorBanner,Loading} from '../lib/ui'
export default function PlanAccess({companyId,onSaved}:{companyId:string;onSaved:()=>void}){
 const [reply,setReply]=useState<ModuleScopeReply|null>(null),[selected,setSelected]=useState<string[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),active=useRef(true)
 useEffect(()=>{let live=true;active.current=true;setReply(null);setError('');getModuleScopes(companyId).then(value=>{if(live){setReply(value);setSelected(Array.isArray(value.scope?.data.vision)?value.scope.data.vision as string[]:[])}}).catch(e=>{if(live)setError(e.message)});return()=>{live=false;active.current=false}},[companyId])
 const current=Array.isArray(reply?.scope?.data.vision)?reply?.scope?.data.vision as string[]:[],changed=selected.slice().sort().join('|')!==current.slice().sort().join('|')
 async function save(){if(!reply||busy)return;setBusy(true);setError('');setSaved(false);try{
  const visibility:ModuleVisibility={vision:selected,accountability:Array.isArray(reply.scope?.data.accountability)?reply.scope.data.accountability as string[]:[]};
  const result=await saveModuleScope(companyId,visibility,reply.scope?.rev||0);if(!active.current)return;setReply({...reply,scope:result});setSaved(true);onSaved()
 }catch(e){if(active.current)setError((e as Error).message)}finally{if(active.current)setBusy(false)}}
 return <section className="plan-access" aria-label="Plan team access"><h3>Teams with plan access</h3><p className="module-note">Members of the selected teams can read this company plan. Administrators in those teams can edit it.</p><ErrorBanner error={error}/>{!reply&&!error?<Loading what="Loading plan access"/>:reply&&<><fieldset disabled={busy}><legend>Select teams</legend>{reply.teams.filter(t=>t.companyId===companyId).map(team=><label key={team.id}><input type="checkbox" checked={selected.includes(team.id)} onChange={e=>{setSaved(false);setSelected(ids=>e.target.checked?[...ids,team.id]:ids.filter(id=>id!==team.id))}}/>{team.name}</label>)}</fieldset>{!selected.length&&<p className="module-note">No teams selected. The plan will be restricted.</p>}<button className="btn btn--primary" disabled={busy||!changed} onClick={()=>void save()}>{busy?'Saving…':'Save plan access'}</button><span role="status">{saved?'Plan access saved.':''}</span></>}</section>
}
