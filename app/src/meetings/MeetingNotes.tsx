import {Fragment,useEffect,useRef,useState} from 'react'
import {getMeetingNotes,saveMeetingNotes} from '../api'
import type {LiveSessionView} from '../../../platform/liveSessionModel'
import type {MeetingNotesView,NoteRevision} from '../../../platform/meetingNotes'

function Inline({text}:{text:string}) {
 return <>{text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).map((part,index)=>part.startsWith('**')&&part.endsWith('**')?<strong key={index}>{part.slice(2,-2)}</strong>:part.startsWith('*')&&part.endsWith('*')?<em key={index}>{part.slice(1,-1)}</em>:<Fragment key={index}>{part}</Fragment>)}</>
}
export function NotesPreview({text}:{text:string}) {
 const lines=text.split('\n'),blocks:React.ReactNode[]=[]
 for(let i=0;i<lines.length;){const line=lines[i],bullet=/^\s*[-*] /.test(line),number=/^\s*\d+\. /.test(line)
  if(bullet||number){const items:React.ReactNode[]=[];const pattern=bullet?/^\s*[-*] /:/^\s*\d+\. /;const start=i;while(i<lines.length&&pattern.test(lines[i])){items.push(<li key={i}><Inline text={lines[i].replace(pattern,'')}/></li>);i++}blocks.push(bullet?<ul key={start}>{items}</ul>:<ol key={start}>{items}</ol>)}
  else {blocks.push(<p key={i}><Inline text={line||'\u00a0'}/></p>);i++}
 }
 return <div className="meeting-notes__preview">{blocks}</div>
}
const headKey=(versions:NoteRevision[])=>versions.map(version=>version.id).sort().join('|')
function SectionEditor({label,versions,canEdit,onSave}:{label:string;versions:NoteRevision[];canEdit:boolean;onSave:(text:string,parents:string[])=>Promise<NoteRevision[]>}) {
 const initial=versions.length===1?versions[0].text:'', [text,setText]=useState(initial),[dirty,setDirty]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState(false)
 const base=useRef(headKey(versions)),parents=useRef(versions.map(version=>version.id)),input=useRef<HTMLTextAreaElement>(null),writing=useRef(false),latestText=useRef(text),alive=useRef(true)
 latestText.current=text
 const remoteKey=headKey(versions),conflict=versions.length>1||(dirty&&remoteKey!==base.current)
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
 useEffect(()=>{if(!dirty&&!writing.current){base.current=remoteKey;parents.current=versions.map(version=>version.id);setText(versions.length===1?versions[0].text:'')}},[remoteKey,dirty])
 async function save(merge=false){if(writing.current||!canEdit||(!merge&&(!dirty||conflict)))return;writing.current=true;setSaving(true);setError('');const value=latestText.current
  try {const saved=await onSave(value,merge?versions.map(version=>version.id):parents.current);if(!alive.current)return;base.current=headKey(saved);parents.current=saved.map(version=>version.id);setDirty(latestText.current!==value)}catch(error){if(alive.current)setError((error as Error).message)}finally{writing.current=false;if(alive.current)setSaving(false)}
 }
 useEffect(()=>{if(!dirty||conflict||saving||error||!canEdit)return;const timer=window.setTimeout(()=>void save(),800);return()=>window.clearTimeout(timer)},[text,dirty,conflict,saving,error,canEdit,remoteKey])
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty])
 function format(kind:'bold'|'italic'|'bullet'|'number') {const element=input.current;if(!element)return;const start=element.selectionStart,end=element.selectionEnd,selected=text.slice(start,end);let replacement:string
  if(kind==='bold'||kind==='italic'){const mark=kind==='bold'?'**':'*';replacement=mark+(selected||'text')+mark}
  else replacement=(selected||'List item').split('\n').map((line,index)=>(kind==='bullet'?'- ':`${index+1}. `)+line).join('\n')
  const next=text.slice(0,start)+replacement+text.slice(end);setText(next);setDirty(true);setError('');element.focus();window.requestAnimationFrame(()=>element.setSelectionRange(start,start+replacement.length))
 }
 return <section className="meeting-notes__section" aria-label={`${label} notes`}><h3>{label}</h3>
 {conflict&&<div className="meeting-notes__conflict" role="alert"><strong>Notes changed in another window.</strong><p>Review these saved versions. Combine the text below, then select Save merged notes.</p>{versions.map(version=><details key={version.id}><summary>{version.authorName} · {new Date(version.at).toLocaleTimeString()}</summary><NotesPreview text={version.text}/></details>)}</div>}
 {canEdit?<><div className="meeting-notes__tools" role="group" aria-label={`Format ${label} notes`}><button type="button" className="btn btn--sm" aria-label="Bold" disabled={preview} onMouseDown={event=>event.preventDefault()} onClick={()=>format('bold')}><strong>B</strong></button><button type="button" className="btn btn--sm" aria-label="Italic" disabled={preview} onMouseDown={event=>event.preventDefault()} onClick={()=>format('italic')}><em>I</em></button><button type="button" className="btn btn--sm" disabled={preview} onMouseDown={event=>event.preventDefault()} onClick={()=>format('bullet')}>• List</button><button type="button" className="btn btn--sm" disabled={preview} onMouseDown={event=>event.preventDefault()} onClick={()=>format('number')}>1. List</button><button type="button" className="btn btn--sm" aria-pressed={preview} onClick={()=>setPreview(value=>!value)}>{preview?'Write':'Preview'}</button></div>
 {preview?<NotesPreview text={text}/>:<textarea ref={input} className="input" rows={5} maxLength={20000} aria-label={`${label} notes text`} value={text} placeholder="Take notes here…" onChange={event=>{setText(event.target.value);setDirty(true);setError('')}}/>}
 <div className="meeting-notes__status" role="status">{saving?'Saving…':error?'Not saved':dirty?'Unsaved changes':versions.length?'Saved':'No notes yet'}</div>
 {error&&<p role="alert">{error}</p>}{conflict?<button type="button" className="btn btn--sm" disabled={saving||!dirty} onClick={()=>void save(true)}>Save merged notes</button>:error&&<button type="button" className="btn btn--sm" disabled={saving} onClick={()=>void save()}>Retry save</button>}</>:<NotesPreview text={versions.length===1?versions[0].text:versions.length?'Review saved versions above.':'No notes for this section.'}/>}
 </section>
}
export default function MeetingNotes({companyId,session}:{companyId:string;session:LiveSessionView}) {
 const [open,setOpen]=useState(false),[data,setData]=useState<MeetingNotesView|null>(null),[error,setError]=useState('')
 const generation=useRef(0),writes=useRef(0),mounted=useRef(true)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{if(!open)return;let active=true,pending=false;const read=async()=>{if(pending||writes.current)return;pending=true;const ticket=generation.current;try{const result=await getMeetingNotes({companyId,sessionId:session.id});if(active&&ticket===generation.current&&!writes.current){setData(result);setError('')}}catch(error){if(active)setError((error as Error).message)}finally{pending=false}};void read();const timer=window.setInterval(()=>void read(),2000);return()=>{active=false;window.clearInterval(timer)}},[open,companyId,session.id])
 async function save(sectionId:string,text:string,parents:string[]) {++writes.current;++generation.current;try{const result=await saveMeetingNotes({companyId,sessionId:session.id,sectionId,text,parents});if(mounted.current)setData(current=>current?{...result,sections:current.sections.map(section=>section.sectionId===sectionId?(result.sections.find(value=>value.sectionId===sectionId)||section):section)}:result);return result.sections.find(section=>section.sectionId===sectionId)?.versions||[]}finally{--writes.current;++generation.current}}
 return <aside className={'meeting-notes'+(open?' meeting-notes--open':'')} aria-label="Meeting notes"><button className="btn meeting-notes__toggle" type="button" aria-expanded={open} aria-controls="meeting-notes-panel" onClick={()=>setOpen(value=>!value)}>{open?'Close notes':'Notes'}</button><div id="meeting-notes-panel" hidden={!open}><h2>Meeting notes</h2><p className="muted">Shared with meeting participants. Edits save automatically. Use the formatting buttons or Markdown.</p>{session.status==='ended'&&<p className="muted">Meeting ended. Notes are read-only.</p>}{error&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">Loading notes…</p>}{data&&session.sections.map((section,index)=><SectionEditor key={section.id} label={`${index+1}. ${section.label}`} versions={data.sections.find(notes=>notes.sectionId===section.id)?.versions||[]} canEdit={data.canEdit&&session.status!=='ended'} onSave={(text,parents)=>save(section.id,text,parents)}/>)}</div></aside>
}
