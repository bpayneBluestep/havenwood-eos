export interface LiveSection {id:string;label:string;minutes:number;spentMs:number}
export interface LiveSession {id:string;title:string;companyId:string;meetingId:string;date:string;hostId:string;hostName:string;status:'running'|'paused'|'ended';activeIndex:number;activeStartedAt:number|null;startedAt:number;endedAt:number|null;sections:LiveSection[];rev:number}
export interface LiveParticipant {userId:string;name:string;joinedAt:number;rating:number|null;updatedAt:number}
export interface LiveTangent {id:string;userId:string;name:string;calledAt:number}
export interface LiveSessionView extends LiveSession {tangents?:LiveTangent[];participants:LiveParticipant[];joined:boolean;canControl:boolean;serverNow:number}
export const defaultLiveSections=():LiveSection[]=>[
 {id:'segue',label:'Segue',minutes:5,spentMs:0},
 {id:'headlines',label:'Headlines',minutes:5,spentMs:0},
 {id:'todos',label:'Action Items',minutes:5,spentMs:0},
 {id:'scorecard',label:'Scorecard',minutes:5,spentMs:0},
 {id:'ids',label:'Issues',minutes:65,spentMs:0},
 {id:'conclude',label:'Conclusion',minutes:5,spentMs:0}]
export function liveSectionMs(session:LiveSession,index:number,now:number):number {
 return (session.sections[index]?.spentMs || 0)+(session.status==='running'&&session.activeIndex===index&&session.activeStartedAt!==null?Math.max(0,now-session.activeStartedAt):0)
}
export function liveTotalMs(session:LiveSession,now:number):number {
 return session.sections.reduce((total,_,index)=>total+liveSectionMs(session,index,now),0)
}
export function validateLiveTangent(session:LiveSession,actorId:string,participants:LiveParticipant[]):void {
 if(!participants.some(person=>person.userId===actorId))throw new Error('Join this meeting before calling a tangent.')
 if(session.status==='ended')throw new Error('This meeting has ended.')
}
export function changeLiveSection(session:LiveSession,actorId:string,command:string,now:number,index?:number):LiveSession {
 if(actorId!==session.hostId)throw new Error('Only the facilitator can control the meeting timer.')
 if(session.status==='ended')throw new Error('This meeting has ended.')
 const result={...session,sections:session.sections.map(section=>({...section})),rev:session.rev+1}
 function settle(){result.sections[result.activeIndex].spentMs=liveSectionMs(session,session.activeIndex,now);result.activeStartedAt=null}
 if(command==='pause'){if(session.status!=='running')throw new Error('The meeting is not running.');settle();result.status='paused'}
 else if(command==='resume'){if(session.status!=='paused')throw new Error('The meeting is not paused.');result.status='running';result.activeStartedAt=now}
 else if(command==='next'||command==='select'){
  const target=command==='next'?session.activeIndex+1:index
  if(target===undefined||!Number.isInteger(target)||target<0||target>=session.sections.length)throw new Error('Choose an agenda section.')
  settle();result.activeIndex=target;result.activeStartedAt=result.status==='running'?now:null
 }else if(command==='end'){settle();result.status='ended';result.endedAt=now}
 else throw new Error('Unknown meeting command.')
 return result
}
export function validateLiveRating(session:LiveSession,actorId:string,participants:LiveParticipant[],rating:unknown):number {
 if(!participants.some(person=>person.userId===actorId))throw new Error('Join this meeting before submitting a rating.')
 if(session.status!=='ended'&&session.sections[session.activeIndex]?.id!=='conclude')throw new Error('Ratings open when the meeting reaches Conclude.')
 if(typeof rating!=='number'||!Number.isInteger(rating)||rating<1||rating>10)throw new Error('Choose a rating from 1 to 10.')
 return rating
}
export function uniqueLiveParticipants(session:LiveSession,rows:LiveParticipant[]):LiveParticipant[] {
 const people:LiveParticipant[]=[{userId:session.hostId,name:session.hostName,joinedAt:session.startedAt,rating:null,updatedAt:session.startedAt}]
 for(const row of rows){const index=people.findIndex(person=>person.userId===row.userId);if(index<0)people.push({...row});else if(row.updatedAt>=people[index].updatedAt)people[index]={...row}}
 return people
}
