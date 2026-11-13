import {useState} from 'react'
import {useApp} from '../state'
import {Modal} from '../lib/ui'
import {IssueModal} from '../routes/Issues'
import {TodoModal} from '../routes/Todos'
import {HeadlineForm} from '../routes/Headlines'
type Kind='headline'|'todo'|'issue'
export default function QuickCreateButtons({companyId,onSaved}:{companyId:string;onSaved?:()=>void}){
 const {me,companies,teams,team}=useApp()
 const [kind,setKind]=useState<Kind|null>(null),[target,setTarget]=useState(companyId)
 const people=[...new Map(Object.values(teams||{current:team}).flat().map(person=>[person.id,person])).values()]
 const done=()=>{setKind(null);onSaved?.()}
 const close=()=>setKind(null)
 const teamSelect=<label className="field">Team<select className="select" aria-label="Create in team" value={target} onChange={event=>setTarget(event.target.value)}>{companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
 return <><div className="quick-create-buttons" aria-label="Create an item">{([['headline','Headline'],['todo','Action Item'],['issue','Issue']] as const).map(([value,label])=><button key={value} className="btn btn--primary" onClick={()=>{setTarget(companyId);setKind(value)}}>+ {label}</button>)}</div>{kind==='headline'&&<Modal title="New headline" onClose={close}>{teamSelect}<HeadlineForm key={target} companyId={target} onDone={done} onCancel={close}/></Modal>}{kind==='todo'&&<TodoModal key={target} initial={null} companyId={target} team={people} defaultOwnerId={me.id} defaultOwnerName={me.name} onSaved={done} onClose={close} teamSelect={teamSelect}/>} {kind==='issue'&&<IssueModal key={target} initial={null} companyId={target} team={people} term="short" defaultOwnerId={me.id} onSaved={done} onClose={close} teamSelect={teamSelect}/>}</>
}
