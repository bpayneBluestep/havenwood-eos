import {createPortal} from 'react-dom'
import L10 from '../routes/L10'
import {useEffect,useRef,useState} from 'react'
import {getLiveSessions,liveSessionAction} from '../api'
import {useApp} from '../state'
import {clockText} from './model'
import {liveSectionMs} from '../../../platform/liveSessionModel'
import type {LiveSessionView} from '../../../platform/liveSessionModel'
import './live.css'
export default function LiveMeetings({companyId,meetingId,date,onActiveChange}:{companyId:string;meetingId?:string;date?:string;onActiveChange?:(active:boolean)=>void}) {
 const {me,liveMeetings}=useApp()
 const [sessions,setSessions]=useState<LiveSessionView[]>([]),[selected,setSelected]=useState<string|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[clock,setClock]=useState(Date.now())
 const offset=useRef(0),writing=useRef(false),version=useRef(0),mounted=useRef(true)
 useEffect(()=>{if(!liveMeetings)return;let active=true;mounted.current=true;setSessions([]);setSelected(null);const read=async()=>{if(writing.current)return;const ticket=++version.current;try{const result=await getLiveSessions({companyId,meetingId,date});if(active&&!writing.current&&ticket===version.current){setSessions(result.sessions);offset.current=result.serverNow-Date.now()}}catch(error){if(active)setError((error as Error).message)}};void read();const poll=window.setInterval(()=>void read(),3000);return()=>{active=false;mounted.current=false;++version.current;window.clearInterval(poll)}},[companyId,meetingId,date,liveMeetings])
 useEffect(()=>{const tick=window.setInterval(()=>setClock(Date.now()),1000);return()=>window.clearInterval(tick)},[])
 async function act(command:string,session?:LiveSessionView,extra:Record<string,unknown>={}){
  if(writing.current)return;writing.current=true;const ticket=++version.current;setBusy(true);setError('')
  try{const result=await liveSessionAction({companyId,meetingId,date,command,sessionId:session?.id,rev:session?.rev,...extra});if(!mounted.current||ticket!==version.current)return;offset.current=result.serverNow-Date.now();setSessions(rows=>[result,...rows.filter(row=>row.id!==result.id)]);setSelected(result.id)}catch(error){if(mounted.current)setError((error as Error).message)}finally{writing.current=false;if(mounted.current)setBusy(false)}
 }
 const session=sessions.find(row=>row.id===selected)
 useEffect(()=>{onActiveChange?.(!!session);return()=>onActiveChange?.(false)},[!!session,onActiveChange])
 if(!liveMeetings)return null
 const now=clock+offset.current
 // Keep stored indexes for sessions started with the earlier agenda.
 const order=['segue','headlines','todos','scorecard','ids','conclude']
 const labels=['Segue','Headlines','Action Items','Scorecard','Issues','Conclusion']
 const agenda=order.map((id,i)=>({id,label:labels[i],index:session?.sections.findIndex(section=>section.id===id) ?? -1})).filter(section=>section.index>=0)
 const activeId=session?.sections[session.activeIndex]?.id || 'segue'
 const currentId=session?.status==='ended'?'conclude':order.includes(activeId)?activeId:'segue'
 const next=agenda[order.indexOf(currentId)+1]
 const sidebar=document.getElementById('live-meeting-sidebar')
 const agendaView=session && <aside className="live-meeting__sidebar" aria-label="Meeting agenda"><h3>Agenda and time spent</h3><ol className="live-meeting__agenda">{agenda.map(section=><li key={section.id} className={section.id===currentId?'is-active':''}><button aria-current={section.id===currentId?'step':undefined} disabled={!session.canControl||busy||session.status==='ended'} onClick={()=>void act('select',session,{index:section.index})}>{section.label}<span>{clockText(liveSectionMs(session,section.index,now))} / {session.sections[section.index].minutes} min</span></button></li>)}</ol></aside>

 return <section className="live-meetings" aria-label="Live meetings"><div className="card card__body"><div className="live-meetings__head"><div><h2>Live meetings</h2><p className="muted">Start a Level 10 agenda or join your team's session. The facilitator controls the shared section timer.</p></div>{!session&&<button className="btn btn--primary" disabled={busy||!me.id} onClick={()=>void act('start')}>Start a meeting</button>}</div>{error&&<p role="alert" className="overdue">{error}</p>}
 {!session?<div className="rows">{sessions.length===0?<p className="muted">No sessions yet. Start a meeting so other team members can join.</p>:sessions.map(row=><div className="rowitem" key={row.id}><div className="rowitem__main"><div className="rowitem__title">{row.title} <span className="pill pill--muted">{row.status==='ended'?'Ended':row.status==='paused'?'Paused':'Live'}</span></div><div className="rowitem__meta">{row.hostName} · {new Date(row.startedAt).toLocaleString()} · {row.participants.length} joined</div></div><button className="btn" disabled={busy} onClick={()=>row.joined||row.status==='ended'?setSelected(row.id):void act('join',row)}>{row.status==='ended'?'View recap':row.joined?'Open meeting':'Join meeting'}</button></div>)}</div>:<>
 <div className="live-meeting__timer"><div><span className="muted">{session.status==='ended'?'Meeting ended':session.status==='paused'?'Paused':'Live'} · {session.hostName}</span><h3>{labels[order.indexOf(currentId)]}</h3></div><strong aria-label="Section time spent">{clockText(liveSectionMs(session,session.activeIndex,now))}</strong></div>
 <div className="live-meeting__controls"><button className="btn" onClick={()=>setSelected(null)}>All meetings</button>{!session.joined&&session.status!=='ended'&&<button className="btn btn--primary" disabled={busy} onClick={()=>void act('join',session)}>Join meeting</button>}{session.canControl&&session.status!=='ended'&&<><button className="btn" disabled={busy} onClick={()=>void act(session.status==='paused'?'resume':'pause',session)}>{session.status==='paused'?'Resume':'Pause'}</button><button className="btn" disabled={busy||!next} onClick={()=>next&&void act('select',session,{index:next.index})}>Next section</button><button className="btn" disabled={busy} onClick={()=>void act('end',session)}>End meeting</button></>}</div>
 {sidebar?createPortal(agendaView,sidebar):agendaView}
 <div className="live-meeting__content">
 {!meetingId && <L10 key={companyId} embedded section={currentId}/>}
 {meetingId && <p className="muted">Review this meeting's {labels[order.indexOf(currentId)].toLowerCase()} using the private follow-ups below.</p>}
 {(currentId==='conclude'||session.status==='ended')&&<section><h3>Participants</h3>{session.participants.map(person=><p key={person.userId}>{person.name} {person.rating===null?'· Not rated':`· ${person.rating}/10`}</p>)}</section>}
 </div>
 {(session.status==='ended'||session.sections[session.activeIndex].id==='conclude')&&session.joined&&<section className="live-meeting__ratings"><h3>Rate this meeting: 1–10</h3><p className="muted">Each joined participant submits their own rating. You can update yours here.</p><div className="seg" role="group" aria-label="Your meeting rating">{Array.from({length:10},(_,i)=>i+1).map(rating=><button key={rating} disabled={busy} aria-pressed={session.participants.find(person=>person.userId===me.id)?.rating===rating} onClick={()=>void act('rate',session,{rating})}>{rating}</button>)}</div></section>}
 </>}
 </div></section>
}
