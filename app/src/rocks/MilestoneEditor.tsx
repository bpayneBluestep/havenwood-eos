import {useState} from 'react'
import type {Rock,Milestone,Person} from '../api'
import {saveMilestone} from '../api'
import {Modal,OwnerPicker,ErrorBanner} from '../lib/ui'
export default function MilestoneEditor({rock,item,people,onClose,onSaved}:{rock:Rock;item:Milestone;people:Person[];onClose:()=>void;onSaved:()=>void}){
 const [title,setTitle]=useState(item.title),[ownerId,setOwnerId]=useState(item.ownerId||''),[dueDate,setDueDate]=useState(item.dueDate||''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const save=async()=>{if(!title.trim())return;setBusy(true);setError('');try{await saveMilestone(rock.id,{id:item.id,title:title.trim(),ownerId,dueDate},rock.rev);onSaved()}catch(error){setError((error as Error).message)}finally{setBusy(false)}}
 return <Modal title="Edit milestone" onClose={onClose}><ErrorBanner error={error}/><label className="field">Milestone<input autoFocus className="input" value={title} onChange={event=>setTitle(event.target.value)} disabled={busy}/></label><label className="field">Owner<OwnerPicker team={people} value={ownerId} onChange={id=>setOwnerId(id)}/></label><label className="field">Due date<input className="input" type="date" value={dueDate} onChange={event=>setDueDate(event.target.value)} disabled={busy}/></label><div className="live-meeting__controls"><button className="btn" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn--primary" onClick={()=>void save()} disabled={busy||!title.trim()}>Save milestone</button></div></Modal>
}
