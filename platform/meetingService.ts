import {emptyTimer,transition,validateAgenda} from './meetingModel'
import type {AgendaQuestion,CapturedItem,ItemKind,TimerCommand,Workspace} from './meetingModel'
export interface Team {id:string;name:string;people:{id:string;name:string}[]}
export interface NativeItem extends CapturedItem {meetingSource?:CapturedItem['context'];meetingId?:string;occurrenceDate?:string;archivedAt?:string|null;[key:string]:unknown}
export interface StoredSession {id:string;meetingId:string;companyId:string;date:string;ownerId:string;ownerName:string;agenda:AgendaQuestion[];timer:Workspace['timer'];rev:number}
export interface Store {
 actor:{id:string;name:string;super:boolean};teams:Team[];now():number;newId(prefix:string):string
 privateMeeting(id:string,date:string):{companyId:string;ownerId:string;ownerName:string;attendees:{id:string;name:string}[];cancelled:boolean}|null
 getSession(teamId:string,key:string):StoredSession|null;putSession(value:StoredSession):void
 items(teamId:string):NativeItem[];saveItem(teamId:string,value:NativeItem,expectedRev?:number):NativeItem
 disclosures(teamId:string):NativeItem[];putDisclosures(teamId:string,items:NativeItem[]):void
}
export class MeetingError extends Error {constructor(public code:string,message:string){super(message)}}
function requireValue(ok:unknown,code:string,message:string):asserts ok{if(!ok)throw new MeetingError(code,message)}
function ids(value:unknown):string[]{requireValue(Array.isArray(value),'INVALID','Choose teams from the available list.');requireValue(value.every(id=>typeof id==='string'),'INVALID','Invalid team ID.');return [...new Set(value as string[])]}
export function authorize(store:Store,input:Record<string,unknown>){
 const date=String(input.date??'');requireValue(/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date,'INVALID','Use a valid meeting date.')
 const meetingId=String(input.meetingId??'');const privateMeeting=meetingId?store.privateMeeting(meetingId,date):null
 if(meetingId)requireValue(privateMeeting,'NOT_FOUND','No such meeting occurrence.')
 const companyId=privateMeeting?.companyId??String(input.companyId??'');const team=store.teams.find(team=>team.id===companyId);requireValue(team,'NOT_FOUND','No such team.')
 const key=(meetingId?'private:'+meetingId:'l10:'+companyId)+':'+date
 return{date,meetingId,companyId,team,key,people:privateMeeting?.attendees??team.people,ownerId:privateMeeting?.ownerId??'',ownerName:privateMeeting?.ownerName??'',cancelled:privateMeeting?.cancelled??false}
}
const l10:AgendaQuestion[]=[['segue','Segue',300],['scorecard','Scorecard',300],['rocks','Rock Review',300],['headlines','Headlines',300],['todos','To-Do List',300],['ids','IDS',3600],['conclude','Conclude',300]].map(([id,label,seconds])=>({id:String(id),label:String(label),seconds:Number(seconds)}))
function session(store:Store,input:Record<string,unknown>){const scope=authorize(store,input);const saved=store.getSession(scope.companyId,scope.key);const value=saved??{id:scope.key,meetingId:scope.meetingId,companyId:scope.companyId,date:scope.date,ownerId:scope.ownerId,ownerName:scope.ownerName,agenda:scope.meetingId?[{id:'discussion',label:'Discussion',seconds:900},{id:'followup',label:'Follow-up and recap',seconds:300}]:l10.map(i=>({...i})),timer:emptyTimer(),rev:0};return{scope,value}}
export function readWorkspace(store:Store,input:Record<string,unknown>):Workspace {const{scope,value}=session(store,input);return{...value,canControl:!scope.cancelled&&(store.actor.super||!value.ownerId||value.ownerId===store.actor.id),items:store.items(scope.companyId).filter(item=>!item.archivedAt&&item.context?.sessionId===scope.key),serverNow:store.now()}}
export function commandWorkspace(store:Store,input:Record<string,unknown>):Workspace {
 const{scope,value}=session(store,input);requireValue(!scope.cancelled,'FORBIDDEN','This meeting date is cancelled.');requireValue(store.actor.super||!value.ownerId||value.ownerId===store.actor.id,'FORBIDDEN','Only the meeting owner can control the timer.');requireValue(Number.isInteger(input.rev)&&input.rev===value.rev,'STALE','The meeting changed. Refresh before trying again.')
 const commands=['configure','start','pause','resume','next','select','end'];requireValue(commands.includes(String(input.command)),'INVALID','Unknown timer command.')
 let changed;try{changed=transition(value.timer,value.agenda,input as unknown as TimerCommand,store.now())}catch(error){throw new MeetingError('INVALID',(error as Error).message)}
 const next={...value,...changed,ownerId:value.ownerId||store.actor.id,ownerName:value.ownerName||store.actor.name,rev:value.rev+1};store.putSession(next);return readWorkspace(store,input)
}
export function synchronizeDisclosures(store:Store,current:NativeItem,previous?:NativeItem){
 const targets=[...new Set([...(previous?.sharedTeamIds??[]),...(current.sharedTeamIds??[])])];for(const id of targets)requireValue(store.teams.some(team=>team.id===id),'FORBIDDEN','You must still have access to every disclosed team to change this item.')
 for(const teamId of targets){const rows=store.disclosures(teamId);
 const key=current.context.sessionId+'|'+current.kind+'|'+current.id
 const kept=rows.filter(row=>row.disclosureKey!==key)
 if(current.sharedTeamIds.includes(teamId)&&!current.archivedAt)kept.push({...current,id:'shared:'+key,meetingId:'',occurrenceDate:'',meetingSource:{...current.context},sharedFrom:{id:current.id,kind:current.kind,companyId:current.companyId??''},disclosureKey:key,readOnly:true,sharedTeamIds:[]})
 store.putDisclosures(teamId,kept)}
}
export function captureItem(store:Store,input:Record<string,unknown>,editing=false):Workspace {
 const{scope,value}=session(store,input);requireValue(!scope.cancelled,'FORBIDDEN','This meeting date is cancelled.');requireValue(Number.isInteger(input.rev)&&input.rev===value.rev,'STALE','The meeting changed. Refresh before saving.')
 const kind=String(input.kind??'') as ItemKind;requireValue(['rock','headline','todo','issue'].includes(kind),'INVALID','Choose a supported item type.')
 const current=editing?store.items(scope.companyId).find(item=>item.id===input.id&&item.kind===kind&&item.context?.sessionId===scope.key):undefined
 if(editing){requireValue(current,'NOT_FOUND','No such meeting item.');requireValue(Number.isInteger(input.itemRev)&&input.itemRev===current.rev,'STALE','The item changed. Refresh before saving.')}
 const section=editing?{id:current!.context.sectionId,label:current!.context.sectionLabel}:value.agenda.find(section=>section.id===input.sectionId);requireValue(section,'INVALID','Choose a section from this agenda.')
 const title=String(input.title??'').trim(),description=String(input.description??'');requireValue(title&&title.length<=2000&&description.length<=20000,'INVALID','Enter a title of up to 2000 characters and details of up to 20000 characters.')
 const sharedTeamIds=ids(input.sharedTeamIds??[]);for(const id of [...sharedTeamIds,...(current?.sharedTeamIds??[])])requireValue(store.teams.some(team=>team.id===id),'FORBIDDEN','Choose only teams you have access to.')
 const responsibleTeamId=kind==='issue'?String(input.responsibleTeamId??''):'';const responsible=store.teams.find(team=>team.id===responsibleTeamId);requireValue(!responsibleTeamId||responsible,'FORBIDDEN','Choose a responsible team you can access.')
 const people=[...scope.people,...store.teams.filter(team=>sharedTeamIds.includes(team.id)).flatMap(team=>team.people)];const ownerId=String(input.ownerId??'');const owner=people.find(person=>person.id===ownerId);requireValue(!ownerId||owner,'INVALID','The owner must be an attendee or a member of a disclosed team.')
 const item:NativeItem={...(current??{}),id:current?.id??store.newId(kind),companyId:scope.companyId,kind,title,description,ownerId,ownerName:owner?.name??'',responsibleTeamId,responsibleTeamName:responsible?.name??'',sharedTeamIds,context:current?.context??{sessionId:scope.key,meetingId:scope.meetingId,date:scope.date,sectionId:section.id,sectionLabel:section.label},rev:current?.rev??0,status:current?.status??(kind==='rock'?'on_track':'open'),meetingId:scope.meetingId,occurrenceDate:scope.date}
 item.meetingSource={...item.context};const saved=store.saveItem(scope.companyId,item,current?.rev);synchronizeDisclosures(store,saved,current);store.putSession({...value,rev:value.rev+1});return readWorkspace(store,input)
}
export function validateSavedAgenda(value:AgendaQuestion[]){return validateAgenda(value)}
