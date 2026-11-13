import {useEffect,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {getLiveMeetingDirectory} from '../api'
import type {LiveMeetingListing} from '../api'
import {useApp} from '../state'
import {Modal} from '../lib/ui'
export default function LiveMeetingLink(){
 const {liveMeetings,setCompanyId,companies}=useApp(),nav=useNavigate()
 const [rows,setRows]=useState<LiveMeetingListing[]>([]),[open,setOpen]=useState(false),[error,setError]=useState('')
 useEffect(()=>{if(!liveMeetings)return;let active=true,reading=false;const load=async()=>{if(reading)return;reading=true;try{const result=await getLiveMeetingDirectory();if(active){setRows(result.rows);setError('')}}catch{if(active)setError('Live meetings could not be loaded.')}finally{reading=false}};void load();const timer=window.setInterval(load,10000);return()=>{active=false;window.clearInterval(timer)}},[liveMeetings,companies])
 if(!liveMeetings)return null
 return <><button className="live-meeting-link" onClick={()=>setOpen(true)}><span className={rows.length?'recording-dot':'recording-dot recording-dot--idle'} aria-hidden="true"/>Live Meetings {rows.length>0&&<span>({rows.length})</span>}</button>{open&&<Modal title="Live Meetings" onClose={()=>setOpen(false)}>{error&&<p role="alert">{error}</p>}{!rows.length?<p>No live meetings are available to you.</p>:rows.map(row=><div className="rowitem" key={row.sessionId}><div className="rowitem__main"><strong>{row.title}</strong><div className="muted">{row.companyName}</div></div><button className="btn btn--primary" onClick={()=>{setCompanyId(row.companyId);setOpen(false);nav((row.meetingId?'/meetings/'+encodeURIComponent(row.meetingId)+'?date='+encodeURIComponent(row.date)+'&':'/meetings?')+'session='+encodeURIComponent(row.sessionId))}}>{row.joined?'Open':'Join'}</button></div>)}</Modal>}</>
}
