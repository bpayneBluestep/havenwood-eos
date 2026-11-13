import {validModuleId} from './companyModules'
import type {CanonicalReference} from './companyModules'

export type SeatState = 'filled' | 'vacant' | 'planned'
export interface SourceLink {kind:'source';url:string;label:string}
export type SeatLink = CanonicalReference | SourceLink
export interface SeatSection {id:string;label:string;type:'text'|'list'|'references';text:string;items:string[];links:SeatLink[]}
export interface SeatData {
 title:string;teamId:string;parentSeatId:string;state:SeatState;mission:string;responsibilities:string[];
 mco:string;drivers:string[];obsessions:string[];sections:SeatSection[];interimPersonId:string;
 targetDate:string;links:SeatLink[];sourceText:string;displayOrder:number
}
export interface AssignmentData {seatId:string;personId:string;startDate:string;endDate:string|null}
export interface AssignmentRecord {id:string;companyId:string;archived?:boolean;data:AssignmentData}
export interface SeatRecord {id:string;companyId:string;archived?:boolean;data:SeatData}
export interface SeatTemplate {id:string;name:string;mission:string;responsibilities:string[];mco:string;drivers:string[];obsessions:string[];sections:SeatSection[]}
export interface SeatValidationContext {
 companyId:string;teamIds:string[];personIds:string[];canonicalVisible:(ref:CanonicalReference)=>boolean
}

function object(value:unknown,label:string):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid '+label+'.')
 return value as Record<string,unknown>
}
function text(value:unknown,label:string,limit:number,required=false):string{
 if(value===undefined||value===null)value=''
 if(typeof value!=='string'||value.length>limit||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw Error('Invalid '+label+'.')
 const out=value.trim();if(required&&!out)throw Error(label+' is required.');return out
}
function lines(value:unknown,label:string):string[]{
 if(value===undefined)return []
 if(!Array.isArray(value)||value.length>80)throw Error('Invalid '+label+'.')
 return value.map(item=>text(item,label,3000,true))
}
function optionalId(value:unknown,label:string):string{
 if(value===undefined||value===null||value==='')return ''
 if(!validModuleId(value))throw Error('Invalid '+label+'.')
 return value
}
export function validSeatDate(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false
 const parts=value.split('-').map(Number),year=parts[0],month=parts[1],day=parts[2]
 if(year<1900||year>9999||month<1||month>12)return false
 const leap=year%4===0&&(year%100!==0||year%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31]
 return day>=1&&day<=days[month-1]
}
function date(value:unknown,label:string,required=false):string{
 if(!required&&(value===undefined||value===null||value===''))return ''
 if(!validSeatDate(value))throw Error('Invalid '+label+'.')
 return value
}
export function validateSeatLinks(input:unknown,canonicalVisible:(ref:CanonicalReference)=>boolean):SeatLink[]{
 if(input===undefined)return []
 if(!Array.isArray(input)||input.length>80)throw Error('Invalid seat links.')
 return input.map(value=>{
  const link=object(value,'seat link')
  if(link.kind==='source'){
   const url=text(link.url,'source URL',2000,true)
   if(!/^https?:\/\/[^\s/?#<>"'\\]+(?:[/?#][^\s<>"'\\]*)?$/i.test(url)||/^https?:\/\/[^/]*@/i.test(url))throw Error('Use an HTTP or HTTPS source URL without credentials.')
   return {kind:'source',url,label:text(link.label,'source label',120)||'Open link'}
  }
  if(['rock','issue','measurable'].indexOf(String(link.kind))<0||!validModuleId(link.id)||!validModuleId(link.teamId))throw Error('Invalid execution link.')
  const ref:CanonicalReference={kind:link.kind as CanonicalReference['kind'],id:link.id,teamId:link.teamId}
  if(!canonicalVisible(ref))throw Error('Linked record is not available.')
  return ref
 })
}
function sections(input:unknown,visible:(ref:CanonicalReference)=>boolean):SeatSection[]{
 if(input===undefined)return []
 if(!Array.isArray(input)||input.length>30)throw Error('Use 30 custom sections or fewer.')
 const used:string[]=[]
 return input.map(value=>{
  const section=object(value,'seat section'),id=optionalId(section.id,'section identity')
  if(!id||used.indexOf(id)>=0)throw Error('Use a unique identity for each section.');used.push(id)
  if(['text','list','references'].indexOf(String(section.type))<0)throw Error('Invalid section type.')
  const type=section.type as SeatSection['type']
  return {id,label:text(section.label,'section label',120,true),type,text:type==='text'?text(section.text,'section text',12000):'',items:type==='list'?lines(section.items,'section items'):[],links:type==='references'?validateSeatLinks(section.links,visible):[]}
 })
}
export function validateSeatData(input:unknown,context:SeatValidationContext):SeatData{
 const value=object(input,'seat')
 if(!validModuleId(context.companyId))throw Error('Invalid company identity.')
 const teamId=optionalId(value.teamId,'team')
 if(teamId&&context.teamIds.indexOf(teamId)<0)throw Error('Choose a team in this company.')
 const parentSeatId=optionalId(value.parentSeatId,'parent seat'),interimPersonId=optionalId(value.interimPersonId,'interim contact')
 if(interimPersonId&&context.personIds.indexOf(interimPersonId)<0)throw Error('Choose an available interim contact.')
 if(['filled','vacant','planned'].indexOf(String(value.state))<0)throw Error('Choose a valid seat state.')
 const displayOrder=value.displayOrder===undefined?0:value.displayOrder
 if(typeof displayOrder!=='number'||!Number.isFinite(displayOrder)||Math.abs(displayOrder)>1000000)throw Error('Invalid seat order.')
 return {title:text(value.title,'Seat title',200,true),teamId,parentSeatId,state:value.state as SeatState,mission:text(value.mission,'mission',12000),responsibilities:lines(value.responsibilities,'responsibilities'),mco:text(value.mco,'MCO',12000),drivers:lines(value.drivers,'drivers'),obsessions:lines(value.obsessions,'obsessions'),sections:sections(value.sections,context.canonicalVisible),interimPersonId,targetDate:date(value.targetDate,'target date'),links:validateSeatLinks(value.links,context.canonicalVisible),sourceText:(text(value.sourceText,'source text',30000),typeof value.sourceText==='string'?value.sourceText:''),displayOrder}
}
export function validateSeatOccupancy(seat:SeatData,personId:unknown,allowedPersonIds:string[]):string{
 const id=optionalId(personId,'occupant')
 if(seat.state==='filled'&&!id)throw Error('A filled seat needs one occupant.')
 if(seat.state!=='filled'&&id)throw Error('A vacant or planned seat cannot have an occupant.')
 if(id&&allowedPersonIds.indexOf(id)<0)throw Error('Choose an available occupant.')
 return id
}
export function validateSeatTree(seats:SeatRecord[],candidate:SeatRecord):void{
 if(!validModuleId(candidate.id)||!validModuleId(candidate.companyId))throw Error('Invalid seat identity.')
 const nodes=seats.filter(seat=>seat.id!==candidate.id).concat([candidate])
 if(nodes.length>5000)throw Error('The chart has too many seats.')
 const seen:{[id:string]:boolean}={}
 for(const node of nodes){if(seen[node.id])throw Error('Duplicate seat identity.');seen[node.id]=true}
 if(candidate.archived){if(nodes.some(node=>!node.archived&&node.data.parentSeatId===candidate.id))throw Error('Move or archive child seats first.');return}
 let cursor=candidate,visits=0
 const path:{[id:string]:boolean}={}
 while(cursor.data.parentSeatId){
  if(path[cursor.id]||cursor.data.parentSeatId===candidate.id)throw Error('A seat cannot report to itself or a descendant.')
  path[cursor.id]=true
  const parent=nodes.find(node=>node.id===cursor.data.parentSeatId)
  if(!parent||parent.archived)throw Error('Parent seat is not available.')
  if(parent.companyId!==candidate.companyId)throw Error('A parent seat must belong to the same company.')
  cursor=parent;if(++visits>nodes.length)throw Error('The chart contains a cycle.')
 }
}
export function validateAssignmentData(input:unknown,seatIds:string[],personIds:string[]):AssignmentData{
 const value=object(input,'assignment'),seatId=optionalId(value.seatId,'assignment seat'),personId=optionalId(value.personId,'assignment person')
 if(!seatId||seatIds.indexOf(seatId)<0)throw Error('Assignment seat is not available.')
 if(!personId||personIds.indexOf(personId)<0)throw Error('Assignment person is not available.')
 const startDate=date(value.startDate,'assignment start',true),endDate=value.endDate===null||value.endDate===undefined||value.endDate===''?null:date(value.endDate,'assignment end',true)
 if(endDate&&endDate<startDate)throw Error('Assignment end must follow its start.')
 return {seatId,personId,startDate,endDate}
}
export function currentSeatAssignment(assignments:AssignmentRecord[],seatId:string,at:string):AssignmentRecord|null{
 date(at,'assignment date',true)
 const active=assignments.filter(item=>!item.archived&&item.data.seatId===seatId&&item.data.startDate<=at&&(!item.data.endDate||item.data.endDate>at))
 if(active.length>1)throw Error('This seat has conflicting assignments. Resolve its history before saving.')
 return active[0]||null
}
export function validateAssignmentTimeline(assignments:AssignmentRecord[],seatId:string):void{
 const rows=assignments.filter(item=>!item.archived&&item.data.seatId===seatId).sort((a,b)=>a.data.startDate.localeCompare(b.data.startDate)||a.id.localeCompare(b.id))
 for(let i=0;i<rows.length;i++){
  const row=rows[i].data
  if(!validSeatDate(row.startDate)||(row.endDate&&!validSeatDate(row.endDate))||(row.endDate&&row.endDate<row.startDate))throw Error('Invalid assignment dates.')
  // Empty intervals are retained history when a same-day assignment is replaced.
  if(row.endDate===row.startDate)continue
  for(let j=i+1;j<rows.length;j++){
   const next=rows[j].data;if(next.endDate===next.startDate)continue
   if(!row.endDate||next.startDate<row.endDate)throw Error('A seat can have only one accountable occupant at a time.')
  }
 }
}
export interface AssignmentChange {end:{id:string;data:AssignmentData}[];create:AssignmentData|null}
export function planAssignmentChange(assignments:AssignmentRecord[],seatId:string,nextPersonId:string,effectiveDate:string):AssignmentChange{
 if(!validModuleId(seatId)||nextPersonId&&!validModuleId(nextPersonId))throw Error('Invalid assignment identity.')
 date(effectiveDate,'assignment date',true);validateAssignmentTimeline(assignments,seatId)
 const current=currentSeatAssignment(assignments,seatId,effectiveDate)
 if(assignments.some(item=>!item.archived&&item.data.seatId===seatId&&item.data.startDate>effectiveDate))throw Error('Resolve future assignments before changing the current occupant.')
 if(current&&current.data.personId===nextPersonId)return {end:[],create:null}
 const end=current?[{id:current.id,data:{...current.data,endDate:effectiveDate}}]:[]
 return {end,create:nextPersonId?{seatId,personId:nextPersonId,startDate:effectiveDate,endDate:null}:null}
}
export function validateSeatTemplate(input:unknown):SeatTemplate{
 const value=object(input,'seat template'),id=optionalId(value.id,'template identity')
 if(!id)throw Error('A template identity is required.')
 // Template references are not copied from a wider scope. Add execution links on each seat.
 return {id,name:text(value.name,'Template name',120,true),mission:text(value.mission,'mission',12000),responsibilities:lines(value.responsibilities,'responsibilities'),mco:text(value.mco,'MCO',12000),drivers:lines(value.drivers,'drivers'),obsessions:lines(value.obsessions,'obsessions'),sections:sections(value.sections,()=>false)}
}
