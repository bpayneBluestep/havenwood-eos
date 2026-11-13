import {useState} from 'react'
import {useApp} from '../state'

type Channels={email:boolean;text:boolean}
type Reminder=Channels&{id:string;when:'before'|'on'|'after';days:number}
type Draft={assignment:Channels;reminders:Reminder[]}
const defaults=():Draft=>({assignment:{email:true,text:false},reminders:[{id:'three-days',when:'before',days:3,email:true,text:false}]})
function readDraft(key:string):Draft {
 try {
  const draft=JSON.parse(localStorage.getItem(key)||'null')
  if(draft&&typeof draft.assignment?.email==='boolean'&&typeof draft.assignment?.text==='boolean'&&Array.isArray(draft.reminders)&&draft.reminders.length<=20&&draft.reminders.every((r:any)=>typeof r.id==='string'&&['before','on','after'].includes(r.when)&&Number.isInteger(r.days)&&r.days>=0&&r.days<=365&&typeof r.email==='boolean'&&typeof r.text==='boolean'))return draft
 }catch{}
 return defaults()
}
export default function MyNotifications({embedded=false}:{embedded?:boolean}) {
 const {me}=useApp()
 return <NotificationDraft key={me.id} userId={me.id} embedded={embedded}/>
}
function NotificationDraft({userId,embedded}:{userId:string;embedded:boolean}) {
 const key=`eos:notification-draft:v1:${userId}`
 const [draft,setDraft]=useState<Draft>(()=>readDraft(key))
 const [status,setStatus]=useState('Draft only. Delivery is not connected.')
 const update=(next:Draft)=>{
  setDraft(next)
  try{localStorage.setItem(key,JSON.stringify(next));setStatus('Draft saved in this browser. Delivery is not connected.')}
  catch{setStatus('This browser could not save the draft. Keep this page open to retain your changes.')}
 }
 const channels=(value:Channels,change:(next:Channels)=>void,label:string)=><div className="notification-channels">{(['email','text'] as const).map(channel=><label key={channel}><input type="checkbox" checked={value[channel]} aria-label={`${label}: ${channel==='email'?'Email':'Text'}`} onChange={event=>change({...value,[channel]:event.target.checked})}/>{channel==='email'?'Email':'Text'}</label>)}</div>
 return <section className={embedded?'notification-settings':'page notification-settings'} aria-label="My Notifications">
  <div className="page__head"><div><h1>My Notifications</h1><p className="page__sub">Choose how you want to receive Action Item alerts.</p></div><span className="pill pill--muted">Not connected</span></div>
  <div className="card card__body notification-notice"><strong>No emails or texts will be sent.</strong><p>These choices are a draft stored only in this browser for your account. They do not sync to other devices. Email and text delivery will be connected later. Text messages will also need a verified phone number.</p></div>
  <div className="card card__body"><h2>When an Action Item is assigned to me</h2><p className="muted">Default: email with the Action Item details.</p>{channels(draft.assignment,assignment=>update({...draft,assignment}),'Assignment')}</div>
  <div className="card card__body"><h2>Due date reminders</h2><p className="muted">Default: email 3 days before the due date. Add reminders before, on, or after the due date.</p>
   {draft.reminders.map((rule,index)=><div className="notification-rule" key={rule.id} role="group" aria-label={`Reminder ${index+1}`}>
    <label>When<select className="select" value={rule.when} onChange={event=>update({...draft,reminders:draft.reminders.map(r=>r.id===rule.id?{...r,when:event.target.value as Reminder['when']}:r)})}><option value="before">Before due date</option><option value="on">On due date</option><option value="after">After due date</option></select></label>
    {rule.when!=='on'&&<label>Days<input className="input" type="number" min={0} max={365} value={rule.days} onChange={event=>{const days=Number(event.target.value);if(Number.isInteger(days)&&days>=0&&days<=365)update({...draft,reminders:draft.reminders.map(r=>r.id===rule.id?{...r,days}:r)})}}/></label>}
    {channels(rule,value=>update({...draft,reminders:draft.reminders.map(r=>r.id===rule.id?{...r,...value}:r)}),`Reminder ${index+1}`)}
    <button className="btn btn--sm" aria-label={`Remove reminder ${index+1}`} onClick={()=>update({...draft,reminders:draft.reminders.filter(r=>r.id!==rule.id)})}>Remove</button>
   </div>)}
   <button className="btn" disabled={draft.reminders.length>=20} onClick={()=>update({...draft,reminders:[...draft.reminders,{id:crypto.randomUUID(),when:'after',days:1,email:true,text:false}]})}>+ Add reminder</button>
  </div>
  <p className="muted" role="status">{status}</p>
 </section>
}
