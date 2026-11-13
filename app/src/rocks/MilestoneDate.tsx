import {useEffect,useRef,useState} from 'react'
import type {Milestone} from '../api'
import {dueClass,fmtDate} from '../lib/ui'
export default function MilestoneDate({item,disabled,onSave}:{item:Milestone;disabled?:boolean;onSave:(date:string)=>Promise<void>}) {
 const [editing,setEditing]=useState(false),[date,setDate]=useState(item.dueDate||''),[saving,setSaving]=useState(false),[error,setError]=useState('')
 const timer=useRef<ReturnType<typeof setTimeout>>(),writing=useRef(false),draft=useRef(date)
 const clear=()=>{if(timer.current)clearTimeout(timer.current);timer.current=undefined}
 useEffect(()=>()=>clear(),[])
 async function save(value:string){
  clear();if(writing.current||disabled)return
  if(value===(item.dueDate||'')&&!error){setEditing(false);return}
  writing.current=true;setSaving(true);setError('')
  try{await onSave(value);setEditing(false)}catch(error:unknown){setError(error instanceof Error?error.message:'Could not save the date. Change the date or leave the field to retry.')}finally{writing.current=false;setSaving(false)}
 }
 if(!editing)return <button type="button" className={'date-edit mono faint '+dueClass(item.dueDate,item.done)} disabled={disabled} aria-label={`Edit due date for ${item.title}`} title="Edit due date" onClick={()=>{draft.current=item.dueDate||'';setDate(draft.current);setError('');setEditing(true)}}>{item.dueDate?fmtDate(item.dueDate):'Add due date'}</button>
 return <span className="date-editor"><input className="input" type="date" autoFocus aria-label={`Due date for ${item.title}`} value={date} disabled={saving||disabled} onChange={event=>{const next=event.target.value;draft.current=next;setDate(next);clear();timer.current=setTimeout(()=>void save(next),500)}} onBlur={()=>{void save(draft.current)}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();void save(draft.current)}if(event.key==='Escape'&&!writing.current){event.stopPropagation();clear();setEditing(false)}}}/>{saving&&<span role="status">Saving…</span>}{error&&<span role="alert" className="overdue">{error}</span>}</span>
}
