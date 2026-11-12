export type ItemKind = 'rock' | 'headline' | 'todo' | 'issue'
export interface AgendaQuestion { id: string; label: string; seconds: number }
export interface TimerState { status: 'idle'|'running'|'paused'|'ended'; activeId: string; elapsedMs: number; startedAt: number|null }
export interface MeetingContext { meetingId: string; date: string; sectionId: string; sectionLabel: string; sessionId: string }
export interface CapturedItem { id: string; kind: ItemKind; title: string; description: string; ownerId: string; ownerName: string; responsibleTeamId: string; responsibleTeamName: string; sharedTeamIds: string[]; context: MeetingContext; rev: number; status: string }
export interface Workspace { id: string; meetingId: string; companyId: string; date: string; ownerId: string; ownerName: string; canControl: boolean; agenda: AgendaQuestion[]; timer: TimerState; items: CapturedItem[]; rev: number; serverNow: number }
export type TimerCommand = {command:'configure';agenda:AgendaQuestion[]}|{command:'start'|'pause'|'resume'|'next'|'end'}|{command:'select';itemId:string}
export const emptyTimer=():TimerState=>({status:'idle',activeId:'',elapsedMs:0,startedAt:null})
export function validateAgenda(input:AgendaQuestion[]):AgendaQuestion[]{
 if(!Array.isArray(input)||!input.length||input.length>80)throw new Error('Use 1–80 agenda sections or questions.')
 const ids=new Set<string>();return input.map(item=>{if(!item.id||ids.has(item.id)||!item.label.trim()||!Number.isInteger(item.seconds)||item.seconds<1||item.seconds>86400)throw new Error('Each item needs a unique ID, a name, and 1–86400 seconds.');ids.add(item.id);return{id:item.id,label:item.label.trim(),seconds:item.seconds}})
}
export function elapsed(timer:TimerState,now:number){return timer.elapsedMs+(timer.status==='running'&&timer.startedAt!==null?Math.max(0,now-timer.startedAt):0)}
export function remaining(timer:TimerState,agenda:AgendaQuestion[],now:number){return (agenda.find(i=>i.id===timer.activeId)?.seconds??0)*1000-elapsed(timer,now)}
export function transition(timer:TimerState,agenda:AgendaQuestion[],input:TimerCommand,now:number):{timer:TimerState;agenda:AgendaQuestion[]}{
 let next={...timer};let items=agenda.map(i=>({...i}));const used=elapsed(timer,now)
 if(input.command==='configure'){items=validateAgenda(input.agenda);if(timer.activeId&&!items.some(i=>i.id===timer.activeId)&&['running','paused'].includes(timer.status))throw new Error('Keep the active item until you move to another item.');return{timer:next,agenda:items}}
 if(input.command==='start'){if(!items.length)throw new Error('Configure the agenda first.');if(timer.status==='running'||timer.status==='paused')throw new Error('A session is already active.');next={status:'running',activeId:items[0].id,elapsedMs:0,startedAt:now}}
 if(input.command==='pause'){if(timer.status!=='running')throw new Error('The timer is not running.');next={...next,status:'paused',elapsedMs:used,startedAt:null}}
 if(input.command==='resume'){if(timer.status!=='paused')throw new Error('The timer is not paused.');next={...next,status:'running',startedAt:now}}
 if(input.command==='next'||input.command==='select'){if(!['running','paused'].includes(timer.status))throw new Error('Start the session first.');const index=items.findIndex(i=>i.id===timer.activeId);const target=input.command==='select'?items.find(i=>i.id===input.itemId):items[index+1];if(!target)throw new Error('This is the last agenda item. End the session when ready.');next={...next,activeId:target.id,elapsedMs:0,startedAt:timer.status==='running'?now:null}}
 if(input.command==='end'){if(!['running','paused'].includes(timer.status))throw new Error('No active session.');next={...next,status:'ended',elapsedMs:used,startedAt:null}}
 return{timer:next,agenda:items}
}
export function clockText(milliseconds:number){const seconds=Math.floor(Math.abs(milliseconds)/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}
