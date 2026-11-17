import {Avatar,PersonName} from '../lib/ui'
import type {LiveSessionView} from '../../../platform/liveSessionModel'
export const CONNECTION_WINDOW_MS=60000
export function attendeeConnection(lastSeenAt:number|undefined,now:number,ended:boolean){return !ended&&typeof lastSeenAt==='number'&&lastSeenAt<=now+10000&&now-lastSeenAt<=CONNECTION_WINDOW_MS}
export default function MeetingAttendees({session,roster,now,unavailable=false}:{session:LiveSessionView;roster:{id:string;name:string}[];now:number;unavailable?:boolean}){
 const participants=new Map(session.participants.map(person=>[person.userId,person]))
 const people=[...new Map([...roster,...session.participants.map(person=>({id:person.userId,name:person.name}))].map(person=>[person.id,person])).values()].sort((a,b)=>a.name.localeCompare(b.name))
 const connected=people.filter(person=>attendeeConnection(participants.get(person.id)?.lastSeenAt,now,session.status==='ended')).length
 return <details className="meeting-attendees" open><summary>Meeting attendees <span>{connected}/{people.length}</span></summary>{unavailable&&<p className="meeting-attendees__hint" role="status">Connection check unavailable.</p>}<ul aria-label="Team meeting roster">{people.map(person=>{const participant=participants.get(person.id),online=attendeeConnection(participant?.lastSeenAt,now,session.status==='ended'),label=online?'Connected':participant?'Joined earlier':'Not joined';return <li key={person.id} title={`${person.name}: ${label}`}><Avatar name={person.name} id={person.id} sm/><span className="meeting-attendees__person"><PersonName name={person.name} id={person.id}/><small>{label}</small></span><span className={'meeting-attendees__dot'+(online?' is-connected':'')} aria-label={label}/></li>})}</ul><p className="meeting-attendees__hint">Connection status can take up to one minute to change.</p></details>
}
