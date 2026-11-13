import {createPortal} from 'react-dom'
import L10 from '../routes/L10'
import Issues from '../routes/Issues'
import TangentFireworks from './TangentFireworks'
import {Modal,PersonName} from '../lib/ui'
import {useEffect,useRef,useState} from 'react'
import {getLiveSessions,liveSessionAction,getMeetingTypes} from '../api'
import {useApp} from '../state'
import {clockText} from './model'
import {liveSectionMs,liveTotalMs} from '../../../platform/liveSessionModel'
import type {LiveSessionView} from '../../../platform/liveSessionModel'
import {defaultMeetingTypes} from '../../../platform/meetingTypes'
import type {MeetingType} from '../../../platform/meetingTypes'
import './live.css'
function MeetingControlIcon({kind}:{kind:'pause'|'play'|'back'|'next'}) {
 return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">{kind==='pause'?<><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>:kind==='play'?<path d="M7 4v16l13-8z"/>:kind==='back'?<><rect x="4" y="4" width="3" height="16" rx="1"/><path d="M20 4v16L8 12z"/></>:<><path d="M4 4v16l12-8z"/><rect x="17" y="4" width="3" height="16" rx="1"/></>}</svg>
}
export default function LiveMeetings({companyId,meetingId,date,onActiveChange,fixedMeetingTypeId,requestedSessionId}:{requestedSessionId?:string;fixedMeetingTypeId?:string;companyId:string;meetingId?:string;date?:string;onActiveChange?:(active:boolean)=>void}) {
 const {me,liveMeetings}=useApp()
 const [sessions,setSessions]=useState<LiveSessionView[]>([]),[selected,setSelected]=useState<string|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[clock,setClock]=useState(Date.now())
 const [meetingTypes,setMeetingTypes]=useState<MeetingType[]>(defaultMeetingTypes),[meetingTypeId,setMeetingTypeId]=useState(fixedMeetingTypeId || (meetingId?'one-on-one':'l10')),[teamBusy,setTeamBusy]=useState(false),[showRecaps,setShowRecaps]=useState(false)
 useEffect(()=>{let active=true;void getMeetingTypes(companyId).then(catalog=>{if(active)setMeetingTypes(catalog.types)}).catch(()=>{});return()=>{active=false}},[companyId])
 const [viewedIndex,setViewedIndex]=useState<number|null>(null)
 const [tangentBusy,setTangentBusy]=useState(false)
 const optimisticTangent=useRef<{sessionId:string;id:string}|null>(null)
 const requestedHandled=useRef('')
 useEffect(()=>{setViewedIndex(null)},[selected,companyId])
 const [endFor,setEndFor]=useState<string|null>(null)
 useEffect(()=>setEndFor(null),[selected,companyId])
 const [tangentAlert,setTangentAlert]=useState<{id:string;name:string}|null>(null)
 const tangentSeen=useRef<{sessionId:string;ids:Set<string>}>({sessionId:'',ids:new Set()})
 const offset=useRef(0),writing=useRef(false),version=useRef(0),mounted=useRef(true)
 useEffect(()=>{if(!liveMeetings)return;let active=true,reading=false;mounted.current=true;setSessions([]);setSelected(null);const read=async()=>{if(writing.current||reading)return;reading=true;const ticket=++version.current;try{const result=await getLiveSessions({companyId,meetingId,date});if(active&&!writing.current&&ticket===version.current){setSessions(result.sessions);setTeamBusy(!!result.teamBusy||result.sessions.some(session=>session.status!=='ended'));offset.current=result.serverNow-Date.now()}}catch(error){if(active)setError((error as Error).message)}finally{reading=false}};void read();const poll=window.setInterval(()=>void read(),1000);return()=>{active=false;mounted.current=false;++version.current;window.clearInterval(poll)}},[companyId,meetingId,date,liveMeetings])
 useEffect(()=>{const tick=window.setInterval(()=>setClock(Date.now()),1000);return()=>window.clearInterval(tick)},[])
 async function act(command:string,session?:LiveSessionView,extra:Record<string,unknown>={}){
  if(writing.current)return;writing.current=true;const ticket=++version.current;setBusy(true);setError('')
  try{const result=await liveSessionAction({companyId,meetingId,date,command,sessionId:session?.id,rev:session?.rev,...extra});if(!mounted.current||ticket!==version.current)return;offset.current=result.serverNow-Date.now();setSessions(rows=>[result,...rows.filter(row=>row.id!==result.id)]);setSelected(result.id)}catch(error){if(mounted.current)setError((error as Error).message)}finally{writing.current=false;if(mounted.current)setBusy(false)}
 }
 async function callTangent(session:LiveSessionView){
  if(tangentBusy)return
  const id='local-'+Date.now();optimisticTangent.current={sessionId:session.id,id};
  setTangentAlert({id,name:me.name});setTangentBusy(true);setError('')
  try{
   const result=await liveSessionAction({companyId,meetingId,date,command:'tangent',sessionId:session.id,rev:session.rev});
   if(!mounted.current)return;
   const own=(result.tangents||[]).filter(event=>event.userId===me.id).slice(-1)[0];
   if(own)tangentSeen.current.ids.add(own.id)
  }catch(error){if(mounted.current)setError('Tangent was shown on your screen, but could not be sent to the meeting. '+(error as Error).message)}
  finally{optimisticTangent.current=null;if(mounted.current)setTangentBusy(false)}
 }
 useEffect(()=>{
  if(!requestedSessionId||requestedHandled.current===companyId+requestedSessionId)return
  const target=sessions.find(row=>row.id===requestedSessionId);if(!target)return
  requestedHandled.current=companyId+requestedSessionId
  if(target.joined||target.status==='ended')setSelected(target.id);else void act('join',target)
 },[requestedSessionId,sessions,companyId])
 const session=sessions.find(row=>row.id===selected)
 useEffect(()=>{onActiveChange?.(!!session);return()=>onActiveChange?.(false)},[!!session,onActiveChange])
 useEffect(()=>{
  if(!session||!session.joined){tangentSeen.current={sessionId:'',ids:new Set()};setTangentAlert(null);return}
  const events=session.tangents || []
  if(tangentSeen.current.sessionId!==session.id){tangentSeen.current={sessionId:session.id,ids:new Set(events.map(event=>event.id))};setTangentAlert(null);return}
  const unseen=events.filter(event=>!tangentSeen.current.ids.has(event.id)&&!(optimisticTangent.current?.sessionId===session.id&&event.userId===me.id))
  for(const event of events)tangentSeen.current.ids.add(event.id)
  if(unseen.length){const latest=unseen[unseen.length-1];setTangentAlert({id:latest.id,name:latest.name})}
 },[session])
 useEffect(()=>{if(!tangentAlert)return;const timer=window.setTimeout(()=>setTangentAlert(null),10000);return()=>window.clearTimeout(timer)},[tangentAlert])
 if(!liveMeetings)return null
 const now=clock+offset.current
 // Older sessions keep their original stored indexes; new sessions use their snapshot order.
 const legacyOrder=['segue','headlines','todos','scorecard','ids','conclude']
 const legacyLabels=['Segue','Headlines','Action Items','Scorecard','Issues','Conclusion']
 const agenda=session?.meetingTypeId ? session.sections.map((section,index)=>({id:section.id,label:section.label,index})) : legacyOrder.map((id,i)=>({id,label:legacyLabels[i],index:session?.sections.findIndex(section=>section.id===id) ?? -1})).filter(section=>section.index>=0)
 const reviewIndex=session&&!session.canControl&&viewedIndex!==null?viewedIndex:session?.activeIndex||0
 const active=session?.sections[reviewIndex]
 const currentKind=session?.status==='ended'?'conclude':active?.kind || (legacyOrder.includes(active?.id || '')?active!.id:'segue')
 const currentLabel=session?.status==='ended'?'Conclusion':agenda.find(section=>section.index===reviewIndex)?.label || active?.label || 'Segue'
 const agendaIndex=agenda.findIndex(section=>section.index===session?.activeIndex)
 const previous=agenda[agendaIndex-1]
 const next=agenda[agendaIndex+1]
 const types=meetingTypes.filter(type=>fixedMeetingTypeId?type.id===fixedMeetingTypeId:type.scope===(meetingId?'private':'team'))
 const listed=sessions.filter(session=>showRecaps||session.status!=='ended')
 const sidebar=document.getElementById('live-meeting-sidebar')
 const agendaView=session && <aside className="live-meeting__sidebar" aria-label="Meeting agenda"><h3>Agenda and time spent</h3><ol className="live-meeting__agenda">{agenda.map(section=><li key={section.id} className={section.index===reviewIndex?'is-active':''}><button aria-current={section.index===reviewIndex?'step':undefined} disabled={!session.joined||session.status==='ended'||(session.canControl&&busy)} onClick={()=>session.canControl?void act('select',session,{index:section.index}):setViewedIndex(section.index)}>{section.label}<span>{clockText(liveSectionMs(session,section.index,now))} / {session.sections[section.index].minutes} min</span></button></li>)}</ol></aside>

 return <section className={"live-meetings"+(session?" live-meetings--active":"")} aria-label="Live meetings"><div className="card card__body">{!session&&<div className="live-meetings__head"><div><h2>Live meetings</h2><p className="muted">Start or join your team's meeting. Only one live meeting can run per team.</p></div>{!session&&<div className="live-meeting__controls"><label>Meeting template<select aria-label="Meeting type" className="select" value={meetingTypeId} disabled={busy||teamBusy} onChange={event=>setMeetingTypeId(event.target.value)}>{types.map(type=><option key={type.id} value={type.id}>{type.name}</option>)}</select></label><button className="btn btn--primary" disabled={busy||!me.id||teamBusy||!types.some(type=>type.id===meetingTypeId)} onClick={()=>void act('start',undefined,{meetingTypeId})}>Start a meeting</button><button className="btn" aria-pressed={showRecaps} onClick={()=>setShowRecaps(value=>!value)}>{showRecaps?'Hide recaps':'Show recaps'}</button></div>}</div>}{error&&<p role="alert" className="overdue">{error}</p>}
 {!session?<div className="rows">{teamBusy&&!sessions.some(row=>row.status!=='ended')&&<p className="muted">This team already has a live meeting in progress. Open it from Meetings, or wait for it to end.</p>}{listed.length===0?<p className="muted">No live meeting to display. Start a meeting, or show recaps to review past sessions.</p>:listed.map(row=><div className="rowitem" key={row.id}><div className="rowitem__main"><div className="rowitem__title">{row.title} <span className="pill pill--muted">{row.status==='ended'?'Ended':row.status==='paused'?'Paused':'Live'}</span></div><div className="rowitem__meta"><PersonName name={row.hostName} id={row.hostId}/> · {new Date(row.startedAt).toLocaleString()} · {row.participants.length} joined</div></div><button className="btn" disabled={busy} onClick={()=>row.joined||row.status==='ended'?setSelected(row.id):void act('join',row)}>{row.status==='ended'?'View recap':row.joined?'Open meeting':'Join meeting'}</button></div>)}</div>:<>
 <div className="live-meeting__timer"><div><span className="muted">{session.status==='ended'?'Meeting ended':session.status==='paused'?'Paused':'Live'} · <PersonName name={session.hostName} id={session.hostId}/></span><h3>{currentLabel}</h3>{!session.canControl&&viewedIndex!==null&&<div className="meeting-local-view">Browsing independently · Meeting on {session.sections[session.activeIndex]?.label}<button className="btn btn--sm" onClick={()=>setViewedIndex(null)}>Follow host</button></div>}</div><div className="live-meeting__clocks"><div><span>Total time</span><strong aria-label="Total time spent">{clockText(liveTotalMs(session,now))}</strong></div><div><span>Section time</span><strong aria-label="Section time spent">{clockText(liveSectionMs(session,reviewIndex,now))}</strong></div></div></div>
 <div className="live-meeting__controls">{session.joined&&session.status!=='ended'&&<button className="btn live-meeting__tangent" disabled={tangentBusy} onClick={()=>void callTangent(session)}>Tangent</button>}{!session.joined&&session.status!=='ended'&&<button className="btn btn--primary" disabled={busy} onClick={()=>void act('join',session)}>Join meeting</button>}{session.canControl&&session.status!=='ended'&&<><button className="btn live-meeting__icon" aria-label={session.status==='paused'?'Resume':'Pause'} title={session.status==='paused'?'Resume':'Pause'} disabled={busy} onClick={()=>void act(session.status==='paused'?'resume':'pause',session)}><MeetingControlIcon kind={session.status==='paused'?'play':'pause'}/></button><button className="btn live-meeting__icon" aria-label="Back" title="Previous section" disabled={busy||!previous} onClick={()=>previous&&void act('select',session,{index:previous.index})}><MeetingControlIcon kind="back"/></button><button className="btn live-meeting__icon" aria-label="Next" title="Next section" disabled={busy||!next} onClick={()=>next&&void act('select',session,{index:next.index})}><MeetingControlIcon kind="next"/></button></>}{(session.canEnd||session.canControl)&&session.status!=='ended'&&<button className="btn live-meeting__end" aria-label="End meeting" title="End meeting" disabled={busy} onClick={()=>setEndFor(session.id)}>End</button>}</div>
 {tangentAlert&&<TangentFireworks key={'fireworks-'+tangentAlert.id}/>}
 {tangentAlert&&<div key={'alert-'+tangentAlert.id} className="live-meeting__alert" role="alert" aria-live="assertive"><strong>Tangent called.</strong><PersonName name={tangentAlert.name}/><button className="btn btn--sm" aria-label="Dismiss tangent alert" onClick={()=>setTangentAlert(null)}>Dismiss</button></div>}
 {sidebar?createPortal(agendaView,sidebar):agendaView}
 <div className="live-meeting__content">
 {session.supersededBy&&<p className="muted">This earlier session was superseded. Its recorded history is retained.</p>}
 {active?.prompt&&currentKind!=='notes'&&<p className="live-meeting__prompt">{active.prompt}</p>}
 {currentKind==='notes'&&<div className="card card__body"><h2>{currentLabel}</h2><p className="muted">{active?.prompt || 'Use this time for the discussion.'}</p></div>}
 {(!meetingId || session.teamContent || currentKind==='rocks' || currentKind==='vision') && currentKind!=='notes' && (currentKind==='ids' ? <Issues key={companyId} embedded headingLabel={currentLabel}/> : <L10 key={companyId} companyId={companyId} embedded section={currentKind} sectionLabel={currentLabel} sectionNumber={reviewIndex+1}/>)}
 {meetingId && !session.teamContent && currentKind!=='rocks' && <p className="muted">Review this meeting's {currentLabel.toLowerCase()} using the private follow-ups below.</p>}
 {(currentKind==='conclude'||session.status==='ended')&&<section><h3>Participants</h3>{session.participants.map(person=><p key={person.userId}><PersonName name={person.name} id={person.userId}/> {person.rating===null?'· Not rated':`· ${person.rating}/10`}</p>)}</section>}
 </div>
 {(session.status==='ended'||currentKind==='conclude')&&session.joined&&<section className="live-meeting__ratings"><h3>Rate this meeting: 1–10</h3><p className="muted">Each joined participant submits their own rating. You can update yours here.</p><div className="seg" role="group" aria-label="Your meeting rating">{Array.from({length:10},(_,i)=>i+1).map(rating=><button key={rating} disabled={busy} aria-pressed={session.participants.find(person=>person.userId===me.id)?.rating===rating} onClick={()=>void act('rate',session,{rating})}>{rating}</button>)}</div></section>}
 </>}
 {endFor&&session?.id===endFor&&session.status!=='ended'&&<Modal title="End meeting?" onClose={()=>setEndFor(null)}><p>This will end the current meeting. Are you sure you want to continue?</p><div className="live-meeting__controls"><button autoFocus className="btn" onClick={()=>setEndFor(null)}>Cancel</button><button className="btn live-meeting__end" disabled={busy||!(session.canEnd||session.canControl)} onClick={()=>{setEndFor(null);void act('end',session)}}>End meeting</button></div></Modal>}
 </div></section>
}
