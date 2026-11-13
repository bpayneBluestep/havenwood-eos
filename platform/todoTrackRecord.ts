export type TrackRecordRange='all'|'3m'|'1m'
export function trackRecordStart(today:string,range:TrackRecordRange):string {
 if(range==='all')return ''
 const [year,month,day]=today.split('-').map(Number)
 const date=new Date(Date.UTC(year,month-1-(range==='3m'?3:1),1))
 const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate()
 date.setUTCDate(Math.min(day,last))
 return date.toISOString().slice(0,10)
}
export interface TrackRecordRow {id:string;name:string;onTime:number;scored:number;unscored:number;rate:number|null}
interface HistoricalTodo {ownerId?:string;status?:string;dueDate?:string;completedAt?:string|null;archivedAt?:string|null;personal?:boolean;meetingId?:string}
function recordedDate(value:unknown):string {
 if(typeof value!=='string')return ''
 const date=value.slice(0,10)
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return ''
 const [year,month,day]=date.split('-').map(Number),days=[31,year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31]
 return month>=1&&month<=12&&day>=1&&day<=days[month-1]?date:''
}
export function todoTrackRecord(members:{id:string;name:string}[],todos:HistoricalTodo[],today:string,range:TrackRecordRange='all'):TrackRecordRow[] {
 const from=trackRecordStart(today,range)
 const rows=members.map(member=>({...member,onTime:0,scored:0,unscored:0,rate:null as number|null}))
 for(const todo of todos){
  if(todo.personal||todo.meetingId)continue
  const row=rows.find(member=>member.id===todo.ownerId);if(!row)continue
  const due=recordedDate(todo.dueDate),completed=recordedDate(todo.completedAt),archived=recordedDate(todo.archivedAt)
  if(!due){if(!from)row.unscored++;continue}
  if(from&&(due<from||due>today))continue
  if(todo.status==='done'){if(!completed){row.unscored++;continue}row.scored++;if(completed<=due)row.onTime++}
  else if(todo.status==='open'&&due<today&&!(archived&&archived<=due))row.scored++
 }
 return rows.map(row=>({...row,rate:row.scored?row.onTime/row.scored:null}))
}
