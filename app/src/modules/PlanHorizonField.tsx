import {useEffect,useRef,useState} from 'react'
import {validPlanDate} from '../../../platform/companyPlan'
import {fmtDate} from '../lib/ui'
export default function PlanHorizonField({kind,value,editable,disabled=false,onSave}:{kind:'date'|'year';value:string|number;editable:boolean;disabled?:boolean;onSave:(value:string|number)=>Promise<void>}){
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(String(value)),[saving,setSaving]=useState(false),[error,setError]=useState(''),writing=useRef(false)
 const label=kind==='date'?'3-year target date':'1-year target year'
 useEffect(()=>{if(!editing)setDraft(String(value))},[value,editing])
 async function save(next:string){
  if(writing.current||disabled)return
  if(next===String(value)){setEditing(false);return}
  if(kind==='date'&&next&&!validPlanDate(next)){setError('Enter a valid date.');return}
  if(kind==='year'&&(!/^\d{4}$/.test(next)||Number(next)<1900||Number(next)>9999)){setError('Enter a year from 1900 to 9999.');return}
  writing.current=true;setSaving(true);setError('')
  try{await onSave(kind==='year'?Number(next):next);setEditing(false)}catch(e){setError((e as Error).message)}finally{writing.current=false;setSaving(false)}
 }
 if(!editable)return kind==='date'&&value?<span>Target: {fmtDate(String(value))}</span>:null
 if(!editing)return <button className="btn btn--sm vision-horizon-button" aria-label={`Edit ${label}`} disabled={disabled} onClick={()=>{setDraft(String(value));setError('');setEditing(true)}}>{kind==='year'?'Edit target year':value?`Target: ${fmtDate(String(value))}`:'Set target date'}</button>
 return <div className="vision-horizon-editor"><input className="input" aria-label={label} type={kind==='date'?'date':'number'} min={kind==='year'?1900:undefined} max={kind==='year'?9999:undefined} value={draft} disabled={saving||disabled} autoFocus onChange={e=>{setDraft(e.target.value);setError('')}} onBlur={()=>void save(draft)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void save(draft)}if(e.key==='Escape'&&!writing.current){e.stopPropagation();setEditing(false)}}}/><span role="status">{saving?'Saving…':'Saves when you leave the field.'}</span>{error&&<span role="alert">{error}</span>}</div>
}
