import {useCallback,useEffect,useRef,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {getLiveMeetingDirectory} from '../api'
import type {LiveMeetingListing} from '../api'
import {useApp} from '../state'
import {Modal} from '../lib/ui'
import {useVisiblePolling} from '../lib/useVisiblePolling'
export default function LiveMeetingLink(){
 const {liveMeetings,setCompanyId,companies}=useApp(),nav=useNavigate()
 const [rows,setRows]=useState<LiveMeetingListing[]>([]),[open,setOpen]=useState(false),[error,setError]=useState('')
 const reading=useRef(false),active=useRef(true)
 const load=useCallback(async()=>{if(!liveMeetings||reading.current)return;reading.current=true;try{const result=await getLiveMeetingDirectory();if(active.current){setRows(result.rows);setError('')}}catch{if(active.current)setError('Live meetings could not be loaded.')}finally{reading.current=false}},[liveMeetings])
 useEffect(()=>{active.current=true;void load();return()=>{active.current=false}},[load,companies])
 useVisiblePolling(load,10000,liveMeetings)
 if(!liveMeetings)return null
 return <><button className="live-meeting-link" onClick={()=>setOpen(true)}><span className={rows.length?'recording-dot':'recording-dot recording-dot--idle'} aria-hidden="true"/>Live Meetings {rows.length>0&&<span>({rows.length})</span>}</button>{open&&<Modal title="Live Meetings" onClose={()=>setOpen(false)}>{error&&<p role="alert">{error}</p>}{!rows.length?<p>No live meetings are available to you.</p>:rows.map(row=><div className="rowitem" key={row.sessionId}><div className="rowitem__main"><strong>{row.title}</strong><div className="muted">{row.companyName}</div></div><button className="btn btn--primary" onClick={()=>{setCompanyId(row.companyId);setOpen(false);nav((row.meetingId?'/meetings/'+encodeURIComponent(row.meetingId)+'?date='+encodeURIComponent(row.date)+'&':'/meetings?')+'session='+encodeURIComponent(row.sessionId))}}>{row.joined?'Open':'Join'}</button></div>)}</Modal>}</>
}
