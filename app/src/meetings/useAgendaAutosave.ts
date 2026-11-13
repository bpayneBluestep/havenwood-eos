import {useCallback,useEffect,useRef,useState} from 'react'
import {adminMeetingTypes,adminSaveMeetingTypes} from '../api'
import {validateMeetingTypes} from '../../../platform/meetingTypes'
import type {MeetingTypeCatalog} from '../../../platform/meetingTypes'

export function useAgendaAutosave(teamId:string) {
 const [catalog,setCatalog]=useState<MeetingTypeCatalog|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false)
 const model=useRef({draft:null as MeetingTypeCatalog|null,edit:0,savedEdit:0,writing:false,timer:0,generation:0,teamId:''})
 const mounted=useRef(false)
 const flush=useCallback(async():Promise<void>=>{
  const state=model.current
  window.clearTimeout(state.timer)
  if(!state.draft||state.writing||state.edit===state.savedEdit)return
  const ticket=state.edit,generation=state.generation
  let types
  try {types=validateMeetingTypes(state.draft.types)}catch(error){if(mounted.current)setError((error as Error).message);return}
  state.writing=true
  if(mounted.current){setBusy(true);setError('')}
  let succeeded=false
  try {
   const saved=await adminSaveMeetingTypes(state.teamId,{rev:state.draft.rev,l10Rev:state.draft.l10Rev,types})
   if(!mounted.current||model.current.generation!==generation)return
   state.savedEdit=ticket
   state.draft=state.edit===ticket?saved:{...state.draft!,rev:saved.rev,l10Rev:saved.l10Rev}
   setCatalog(state.draft);setDirty(state.edit!==state.savedEdit);succeeded=true
  }catch(error){if(mounted.current&&model.current.generation===generation)setError((error as Error).message)}
  finally {
   state.writing=false
   if(mounted.current&&model.current.generation===generation){setBusy(false);if(succeeded&&state.edit!==state.savedEdit)state.timer=window.setTimeout(()=>void flush(),0)}
  }
 },[])
 useEffect(()=>{
  mounted.current=true
  const old=model.current;window.clearTimeout(old.timer)
  const state={draft:null as MeetingTypeCatalog|null,edit:0,savedEdit:0,writing:false,timer:0,generation:old.generation+1,teamId}
  model.current=state;setCatalog(null);setError('');setDirty(false);setBusy(false)
  if(teamId)void adminMeetingTypes(teamId).then(result=>{if(mounted.current&&model.current===state){state.draft=result;setCatalog(result)}}).catch(error=>{if(mounted.current&&model.current===state)setError(error.message)})
  return()=>{mounted.current=false;window.clearTimeout(state.timer)}
 },[teamId])
 useEffect(()=>{if(!dirty)return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard)},[dirty])
 const change=useCallback((transform:(current:MeetingTypeCatalog)=>MeetingTypeCatalog)=>{
  const state=model.current
  if(!state.draft)return
  state.draft=transform(state.draft);state.edit++;setCatalog(state.draft);setDirty(true);setError('')
  window.clearTimeout(state.timer);state.timer=window.setTimeout(()=>void flush(),450)
 },[flush])
 return {catalog,error,busy,dirty,change,flush}
}
