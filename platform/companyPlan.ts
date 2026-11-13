import type {CanonicalReference,ModuleEntity} from './companyModules'
import {validModuleId} from './companyModules'

export interface PlanSection {id:string;title:string;body:string}
export type PlanTargetUnit='number'|'currency'|'percent'|'text'
export interface PlanTarget {id:string;label:string;period:string;unit:PlanTargetUnit;value:number|null;currency:string;rawText:string}
export interface PlanData {
 title:string;year:number;mission:string;purpose:string;values:string[];bhag:string;threeYearVision:string;
 horizons:PlanSection[];targets:PlanTarget[];extended:PlanSection[];
 swot:{strengths:string[];weaknesses:string[];opportunities:string[];threats:string[]};sourceText:string;
}
export interface PriorityData {
 title:string;description:string;level:'annual'|'team';year:number;quarter:string;teamId:string;parentPriorityId:string;
 ownerId:string;seatId:string;dueDate:string;status:'active'|'complete';links:CanonicalReference[];sourceText:string;
}
export interface PlanValidationContext {
 companyId:string;priorities:ModuleEntity[];allowedTeamIds:string[];allowedPersonIds:string[];allowedSeatIds:string[];
 canLink:(reference:CanonicalReference)=>boolean;
}
function object(value:unknown,label:string):Record<string,unknown> {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid '+label+'.')
 return value as Record<string,unknown>
}
function text(value:unknown,label:string,limit=10000):string {
 if(value===undefined)return ''
 if(typeof value!=='string'||value.length>limit||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw Error('Invalid '+label+'.')
 return value
}
function year(value:unknown):number {
 if(typeof value!=='number'||!Number.isInteger(value)||value<1900||value>9999)throw Error('Use a valid plan year.')
 return value
}
function id(value:unknown,label:string,optional=false):string {
 if(optional&&(value===''||value===undefined))return ''
 if(!validModuleId(value))throw Error('Invalid '+label+'.')
 return value
}
function texts(value:unknown,label:string,max=100):string[] {
 if(value===undefined)return []
 if(!Array.isArray(value)||value.length>max)throw Error('Invalid '+label+'.')
 return value.map(v=>text(v,label))
}
function unique<T extends {id:string}>(rows:T[],label:string):T[] {
 const seen:Record<string,boolean>={}
 for(const row of rows){if(seen[row.id])throw Error('Duplicate '+label+' identity.');seen[row.id]=true}
 return rows
}
function sections(value:unknown,label:string):PlanSection[] {
 if(value===undefined)return []
 if(!Array.isArray(value)||value.length>60)throw Error('Invalid '+label+'.')
 return unique(value.map(item=>{const row=object(item,label);return {id:id(row.id,label+' identity'),title:text(row.title,label+' title',200),body:text(row.body,label+' text',20000)}}),label)
}
export function validPlanDate(value:unknown):boolean {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false
 const parts=value.split('-').map(Number),y=parts[0],m=parts[1],d=parts[2]
 const leap=y%4===0&&(y%100!==0||y%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31]
 return y>=1900&&m>=1&&m<=12&&d>=1&&d<=days[m-1]
}
export function companyPlanId(companyId:string):string {
 if(!validModuleId(companyId)||companyId.length>115)throw Error('Invalid company identity.')
 return 'plan_'+companyId
}
export function emptyCompanyPlan(planYear:number):PlanData {
 return {title:'Company plan',year:year(planYear),mission:'',purpose:'',values:[],bhag:'',threeYearVision:'',horizons:[],targets:[],extended:[],swot:{strengths:[],weaknesses:[],opportunities:[],threats:[]},sourceText:''}
}
export function validatePlanTarget(input:unknown):PlanTarget {
 const value=object(input,'target'),unit=value.unit
 if(['number','currency','percent','text'].indexOf(String(unit))<0)throw Error('Choose a target unit.')
 const amount=value.value===undefined?null:value.value
 if(amount!==null&&(typeof amount!=='number'||!Number.isFinite(amount)||Math.abs(amount)>1e15))throw Error('Use a finite target value.')
 if(unit==='text'&&amount!==null)throw Error('Keep an unconverted text target separate from a numeric value.')
 const currency=text(value.currency,'currency',3)
 if(unit==='currency'&&!/^[A-Z]{3}$/.test(currency))throw Error('Choose a three-letter currency code.')
 if(unit!=='currency'&&currency)throw Error('A currency code requires a currency target.')
 const label=text(value.label,'target label',200)
 if(!label.trim())throw Error('Enter a target label.')
 const period=text(value.period,'target period',100)
 if(!period.trim())throw Error('Enter the target period.')
 return {id:id(value.id,'target identity'),label:label,period:period,unit:unit as PlanTargetUnit,value:amount as number|null,currency:currency,rawText:text(value.rawText,'target source text',10000)}
}
function bounded<T>(value:T):T {
 if(JSON.stringify(value).length>150000)throw Error('Plan content is too large. Reduce the text before saving.')
 return value
}
export function validateCompanyPlan(input:unknown):PlanData {
 const value=object(input,'company plan'),swot=object(value.swot===undefined?{}:value.swot,'SWOT')
 if(value.targets!==undefined&&(!Array.isArray(value.targets)||value.targets.length>100))throw Error('Invalid plan targets.')
 return bounded({title:text(value.title,'plan title',200)||'Company plan',year:year(value.year),mission:text(value.mission,'mission',20000),purpose:text(value.purpose,'purpose',20000),values:texts(value.values,'core values',50),bhag:text(value.bhag,'BHAG',10000),threeYearVision:text(value.threeYearVision,'three-year vision',20000),horizons:sections(value.horizons,'horizon'),targets:unique(((value.targets||[]) as unknown[]).map(validatePlanTarget),'target'),extended:sections(value.extended,'strategy section'),swot:{strengths:texts(swot.strengths,'strengths'),weaknesses:texts(swot.weaknesses,'weaknesses'),opportunities:texts(swot.opportunities,'opportunities'),threats:texts(swot.threats,'threats')},sourceText:text(value.sourceText,'plan source text',100000)})
}
export function validatePlanPriority(input:unknown,context:PlanValidationContext,priorityId=''):PriorityData {
 const value=object(input,'priority')
 if(value.companyId!==undefined&&value.companyId!==context.companyId)throw Error('Priority company scope cannot change.')
 const title=text(value.title,'priority title',300)
 if(!title.trim())throw Error('Enter a priority title.')
 if(value.level!=='annual'&&value.level!=='team')throw Error('Choose an annual or team priority.')
 if(value.status!=='active'&&value.status!=='complete')throw Error('Choose a valid priority status.')
 const planYear=year(value.year),quarter=text(value.quarter,'quarter',7)
 if(quarter&&(!/^\d{4}-Q[1-4]$/.test(quarter)||Number(quarter.slice(0,4))!==planYear))throw Error('Use a quarter in the priority year.')
 const teamId=id(value.teamId,'priority team',true),parentPriorityId=id(value.parentPriorityId,'parent priority',true),ownerId=id(value.ownerId,'priority owner',true),seatId=id(value.seatId,'accountable seat',true)
 if(value.level==='team'&&!teamId)throw Error('Select a team for a team priority.')
 if(value.level==='annual'&&teamId)throw Error('Annual company priorities do not have a team scope.')
 if(teamId&&context.allowedTeamIds.indexOf(teamId)<0)throw Error('Priority team is not available in this company.')
 if(ownerId&&context.allowedPersonIds.indexOf(ownerId)<0)throw Error('Priority owner is not available.')
 if(seatId&&context.allowedSeatIds.indexOf(seatId)<0)throw Error('Accountable seat is not available.')
 const dueDate=text(value.dueDate,'priority due date',10)
 if(dueDate&&!validPlanDate(dueDate))throw Error('Use a valid priority due date.')
 if(parentPriorityId){
  const seen:Record<string,boolean>={};if(priorityId)seen[priorityId]=true
  let next=parentPriorityId,depth=0
  while(next){
   if(seen[next]||++depth>500)throw Error('Priority links cannot form a cycle.')
   seen[next]=true
   const parent=context.priorities.find(row=>row.id===next&&row.kind==='tenk_priority'&&!row.archived)
   if(!parent||parent.companyId!==context.companyId)throw Error('Parent priority is not available in this company.')
   if(depth===1&&value.level==='team'&&parent.data.level!=='annual')throw Error('Link a team priority to a company annual priority.')
   next=id(parent.data.parentPriorityId,'parent priority',true)
  }
 }
 if(value.links!==undefined&&(!Array.isArray(value.links)||value.links.length>100))throw Error('Invalid execution links.')
 const links:CanonicalReference[]=[],seenLinks:Record<string,boolean>={}
 for(const candidate of (value.links||[]) as unknown[]){
  const link=object(candidate,'execution link'),kind=String(link.kind)
  if(['rock','issue','measurable'].indexOf(kind)<0)throw Error('Invalid execution link kind.')
  const ref:CanonicalReference={kind:kind as CanonicalReference['kind'],id:id(link.id,'execution identity'),teamId:id(link.teamId,'execution team')}
  if(!context.canLink(ref))throw Error('Linked execution record is not available.')
  const key=ref.kind+':'+ref.teamId+':'+ref.id;if(!seenLinks[key]){links.push(ref);seenLinks[key]=true}
 }
 return bounded({title:title,description:text(value.description,'priority description',20000),level:value.level,year:planYear,quarter:quarter,teamId:teamId,parentPriorityId:parentPriorityId,ownerId:ownerId,seatId:seatId,dueDate:dueDate,status:value.status,links:links,sourceText:text(value.sourceText,'priority source text',100000)})
}
export function validatePlanRecord(kind:'tenk_plan'|'tenk_priority',entityId:string,input:unknown,context:PlanValidationContext):PlanData|PriorityData {
 if(!validModuleId(context.companyId)||!validModuleId(entityId))throw Error('Invalid plan identity.')
 const value=object(input,'plan content')
 if(value.companyId!==undefined&&value.companyId!==context.companyId)throw Error('Plan company scope cannot change.')
 if(kind==='tenk_plan'){
  if(entityId!==companyPlanId(context.companyId))throw Error('Use the authoritative company plan identity.')
  return validateCompanyPlan(value)
 }
 if(kind!=='tenk_priority')throw Error('Invalid plan record kind.')
 return validatePlanPriority(value,context,entityId)
}
export function formatPlanTarget(target:PlanTarget):string {
 if(target.value===null)return target.rawText||'Not set'
 const amount=target.value.toLocaleString('en-US',{maximumFractionDigits:6})
 return target.unit==='currency'?target.currency+' '+amount:target.unit==='percent'?amount+'%':amount
}
