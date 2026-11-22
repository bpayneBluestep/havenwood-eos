import MeetingNotesEmail from './MeetingNotesEmail'
import {activityLines} from '../../../platform/meetingActivity'
import RichNotesEditor from './RichNotesEditor'
import {NotesPreview} from './NotesText'
export {NotesPreview} from './NotesText'
import {useCallback,useEffect,useRef,useState} from 'react'
import {getMeetingNotes,saveMeetingNotes} from '../api'
import type {LiveSessionView} from '../../../platform/liveSessionModel'
import type {MeetingNotesView,NoteRevision} from '../../../platform/meetingNotes'
import {useVisiblePolling} from '../lib/useVisiblePolling'

const headKey=(versions:NoteRevision[])=>versions.map(version=>version.id).sort().join('|')
function SectionEditor({label,versions,canEdit,onSave,onPendingChange}:{label:string;versions:NoteRevision[];canEdit:boolean;onSave:(text:string,parents:string[])=>Promise<NoteRevision[]>;onPendingChange?:(pending:boolean)=>void}) {
 const initial=versions.length===1?versions[0].text:'', [text,setText]=useState(initial),[dirty,setDirty]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('')
 const base=useRef(headKey(versions)),parents=useRef(versions.map(version=>version.id)),writing=useRef(false),latestText=useRef(text),alive=useRef(true)
 latestText.current=text
 useEffect(()=>{onPendingChange?.(dirty||saving)},[dirty,saving])
 const remoteKey=headKey(versions),conflict=versions.length>1||(dirty&&remoteKey!==base.current)
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
 useEffect(()=>{if(!dirty&&!writing.current){base.current=remoteKey;parents.current=versions.map(version=>version.id);setText(versions.length===1?versions[0].text:'')}},[remoteKey,dirty])
 async function save(merge=false){if(latestText.current.length>20000||writing.current||!canEdit||(!merge&&(!dirty||conflict)))return;writing.current=true;setSaving(true);setError('');const value=latestText.current
  try {const saved=await onSave(value,merge?versions.map(version=>version.id):parents.current);if(!alive.current)return;base.current=headKey(saved);parents.current=saved.map(version=>version.id);setDirty(latestText.current!==value)}catch(error){if(alive.current)setError((error as Error).message)}finally{writing.current=false;if(alive.current)setSaving(false)}
 }
 useEffect(()=>{if(!dirty||conflict||saving||error||!canEdit)return;const timer=window.setTimeout(()=>void save(),800);return()=>window.clearTimeout(timer)},[text,dirty,conflict,saving,error,canEdit,remoteKey])
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty])
 return <section className="meeting-notes__section" aria-label={`${label} notes`}><h3>{label}</h3>
 {conflict&&<div className="meeting-notes__conflict" role="alert"><strong>Notes changed in another window.</strong><p>Review these saved versions. Combine the text below, then select Save merged notes.</p>{versions.map(version=><details key={version.id}><summary>{version.authorName} · {new Date(version.at).toLocaleTimeString()}</summary><NotesPreview text={version.text}/></details>)}</div>}
 {canEdit?<><RichNotesEditor label={label} text={text} onChange={value=>{setText(value);setDirty(true);setError(value.length>20000?'Keep each section within 20,000 characters.':'')}}/>
 <div className="meeting-notes__status" role="status">{saving?'Saving…':error?'Not saved':dirty?'Unsaved changes':versions.length?'Saved':'No notes yet'}</div>
 {error&&<p role="alert">{error}</p>}{conflict?<button type="button" className="btn btn--sm" disabled={saving||!dirty} onClick={()=>void save(true)}>Save merged notes</button>:error&&<button type="button" className="btn btn--sm" disabled={saving} onClick={()=>void save()}>Retry save</button>}</>:<NotesPreview text={versions.length===1?versions[0].text:versions.length?'Review saved versions above.':'No notes for this section.'}/>}
 </section>
}
export default function MeetingNotes({companyId,session}:{companyId:string;session:LiveSessionView}) {
 const [open,setOpen]=useState(false),[data,setData]=useState<MeetingNotesView|null>(null),[error,setError]=useState(''),[pending,setPending]=useState<Record<string,boolean>>({})
 const generation=useRef(0),writes=useRef(0),mounted=useRef(true),reading=useRef(false)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 const read=useCallback(async()=>{if(reading.current||writes.current)return;reading.current=true;const ticket=generation.current;try{const result=await getMeetingNotes({companyId,sessionId:session.id});if(mounted.current&&ticket===generation.current&&!writes.current){setData(result);setError('')}}catch(error){if(mounted.current&&ticket===generation.current)setError((error as Error).message)}finally{reading.current=false}},[companyId,session.id])
 useEffect(()=>{if(open)void read();return()=>{++generation.current}},[open,companyId,session.id,read])
 useVisiblePolling(read,2000,open)
 async function save(sectionId:string,text:string,parents:string[]) {++writes.current;++generation.current;try{const result=await saveMeetingNotes({companyId,sessionId:session.id,sectionId,text,parents});if(mounted.current)setData(current=>current?{...result,sections:current.sections.map(section=>section.sectionId===sectionId?(result.sections.find(value=>value.sectionId===sectionId)||section):section)}:result);return result.sections.find(section=>section.sectionId===sectionId)?.versions||[]}finally{--writes.current;++generation.current}}
 return <aside className={'meeting-notes'+(open?' meeting-notes--open':'')} aria-label="Meeting notes"><button className="btn meeting-notes__toggle" type="button" aria-expanded={open} aria-controls="meeting-notes-panel" onClick={()=>setOpen(value=>!value)}>{open?'Close notes':'Notes'}</button><div id="meeting-notes-panel" hidden={!open}><h2>Meeting notes</h2><p className="muted">Shared with meeting participants. Edits save automatically. Use the buttons to format your notes. Item actions in this meeting appear below their section. Earlier actions are not reconstructed.</p>{session.status==='ended'&&<p className="muted">Meeting ended. Notes are read-only.</p>}{error&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">Loading notes…</p>}{data&&<MeetingNotesEmail companyId={companyId} sessionId={session.id} history={data.emailHistory||[]} pending={Object.values(pending).some(Boolean)} onSent={view=>setData(current=>current?{...current,emailHistory:view.emailHistory}:view)}/>}{data&&session.sections.map((section,index)=><div key={section.id}><SectionEditor label={`${index+1}. ${section.label}`} versions={data.sections.find(notes=>notes.sectionId===section.id)?.versions||[]} canEdit={data.canEdit&&session.status!=='ended'} onPendingChange={value=>setPending(current=>current[section.id]===value?current:{...current,[section.id]:value})} onSave={(text,parents)=>save(section.id,text,parents)}/><MeetingActivityList events={(data.activities||[]).filter(event=>event.sectionIds.includes(section.id))}/></div>)}{data&&<><MeetingActivityList events={(data.activities||[]).filter(event=>!event.sectionIds.length)} label="Additional meeting activity"/></>}</div></aside>
}

function MeetingActivityList({events,label='Recorded activity'}:{events:import('../../../platform/meetingActivity').MeetingActivity[];label?:string}){return events.length?<section className="meeting-notes__activity" aria-label={label}><h4>{label}</h4><ol>{events.map(event=><li key={event.id}><strong>{activityLines(event)[0]}</strong><small>{new Date(event.at).toLocaleString()}</small>{activityLines(event).slice(1).map((line,index)=><p key={index}>{line}</p>)}</li>)}</ol></section>:null}
