// Development-only synthetic preview. Not included in the production entry.
import {createRoot} from 'react-dom/client'
import MeetingWorkspace from './MeetingWorkspace'
import type {MeetingTransport} from './MeetingWorkspace'
import type {Store,StoredSession,NativeItem} from '../../../platform/meetingService'
import {readWorkspace,commandWorkspace,captureItem} from '../../../platform/meetingService'
import type {CompanyBrief} from '../api'
import '../styles.css'
let count=0
const sessions=new Map<string,StoredSession>(),items:NativeItem[]=[],shared=new Map<string,NativeItem[]>()
const store:Store={actor:{id:'facilitator',name:'Demo Facilitator',super:false},teams:[{id:'team-a',name:'Operations',people:[{id:'facilitator',name:'Demo Facilitator'},{id:'participant',name:'Demo Participant'}]},{id:'team-b',name:'Clinical',people:[{id:'clinical',name:'Clinical Reviewer'}]}],now:()=>Date.now(),newId:kind=>kind+'-'+(++count),privateMeeting:()=>({companyId:'team-a',ownerId:'facilitator',ownerName:'Demo Facilitator',attendees:store.teams[0].people,cancelled:false}),getSession:(_,key)=>sessions.get(key)??null,putSession:value=>{sessions.set(value.id,structuredClone(value))},items:team=>items.filter(item=>item.companyId===team),saveItem:(team,value)=>{const previous=items.find(item=>item.id===value.id);const next={...value,companyId:team,rev:(previous?.rev??0)+1};if(previous)items[items.indexOf(previous)]=next;else items.push(next);return next},disclosures:team=>shared.get(team)??[],putDisclosures:(team,rows)=>{shared.set(team,rows)}}
const transport:MeetingTransport={read:async input=>readWorkspace(store,input),command:async input=>commandWorkspace(store,input),capture:async input=>captureItem(store,input),edit:async input=>captureItem(store,input,true)}
const teams=store.teams.map(team=>({id:team.id,name:team.name})) as CompanyBrief[]
createRoot(document.getElementById('root')!).render(<main className="page" style={{maxWidth:1120,margin:'auto'}}><p className="banner banner--warn">Development preview · synthetic people and records · no BlueStep writes or live deployment</p><h1>Live meeting workspace</h1><MeetingWorkspace companyId="team-a" meetingId="preview" date="2026-11-12" people={store.teams[0].people} teams={teams} rosters={Object.fromEntries(store.teams.map(team=>[team.id,team.people]))} transport={transport}/></main>)
