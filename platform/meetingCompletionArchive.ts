export type CompletionKind='headline'|'todo'|'issue'
export interface CompletionEvent {id:string;itemId:string;action:string;at:number;sourceRevision?:number}
const actions:Record<string,{kind:CompletionKind;complete:boolean}>={
 'Headline reviewed':{kind:'headline',complete:true},'Headline reopened':{kind:'headline',complete:false},
 'Action item completed':{kind:'todo',complete:true},'Action item reopened':{kind:'todo',complete:false},
 'Issue solved':{kind:'issue',complete:true},'Issue reopened':{kind:'issue',complete:false},
}
export function meetingCompletions(events:CompletionEvent[],startedAt:number,endedAt:number){
 const latest:Record<string,CompletionEvent & {kind:CompletionKind;complete:boolean}>={}
 for(const event of events){const type=actions[event.action];if(!type||!event.itemId||event.at<startedAt||event.at>endedAt)continue;const key=type.kind+':'+event.itemId;const prior=latest[key];if(!prior||event.at>prior.at||(event.at===prior.at&&event.id>prior.id))latest[key]={...event,...type}}
 return Object.values(latest).filter(event=>event.complete)
}
export function completionArchiveReason(kind:CompletionKind,item:{rev?:number;archivedAt?:unknown;permanent?:boolean;recurrence?:unknown;recurring?:boolean;status?:string;readDate?:unknown},event:CompletionEvent):string|null {
 if(item.archivedAt)return 'already archived'
 if(item.permanent||item.recurrence||item.recurring)return 'permanent or recurring item'
 if(!Number.isInteger(event.sourceRevision))return 'completion predates revision tracking'
 if(item.rev!==event.sourceRevision)return 'item changed after completion'
 if(kind==='headline'?!item.readDate:kind==='todo'?item.status!=='done':item.status!=='solved')return 'item is not complete'
 return null
}

export function checkedMeetingItem(kind:CompletionKind,item:{archivedAt?:unknown;permanent?:boolean;recurrence?:unknown;recurring?:boolean;status?:string;readDate?:unknown;personal?:boolean;meetingId?:string;occurrenceDate?:string;term?:string},session:{meetingId?:string;date:string;sections:{kind?:string;id:string}[]}):boolean {
 const section={headline:'headlines',todo:'todos',issue:'ids'}[kind]
 if(!session.sections.some(s=>(s.kind||s.id)===section)||item.archivedAt||item.personal||item.permanent||item.recurrence||item.recurring)return false
 if(session.meetingId){if(item.meetingId!==session.meetingId||item.occurrenceDate!==session.date)return false}
 else if(item.meetingId)return false
 if(kind==='issue'&&item.term!=='short')return false
 return kind==='headline'?!!item.readDate:kind==='todo'?item.status==='done':item.status==='solved'
}
