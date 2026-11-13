import {defaultLiveSections} from './liveSessionModel'
import type {LiveSection} from './liveSessionModel'
export interface MeetingType {id:string;name:string;scope:'team'|'private';sections:LiveSection[]}
export interface MeetingTypeCatalog {rev:number;l10Rev?:number;types:MeetingType[]}
export const sectionKinds=['segue','headlines','todos','scorecard','rocks','ids','conclude','notes']
export function defaultMeetingTypes():MeetingType[] {return [
 {id:'l10',name:'L10',scope:'team',sections:defaultLiveSections().map(section=>({...section,kind:section.id,prompt:''}))},
 {id:'one-on-one',name:'One-on-one',scope:'private',sections:[{id:'check-in',kind:'segue',label:'Check-in',minutes:5,spentMs:0,prompt:'Share a personal and professional update.'},{id:'actions',kind:'todos',label:'Action Items',minutes:10,spentMs:0,prompt:''},{id:'discussion',kind:'notes',label:'Discussion',minutes:25,spentMs:0,prompt:'Discuss progress, concerns, and support needed.'},{id:'conclusion',kind:'conclude',label:'Conclusion',minutes:5,spentMs:0,prompt:'Confirm next steps and rate the meeting.'}]}
]}
export function validateMeetingTypes(input:unknown):MeetingType[] {
 if(!Array.isArray(input)||input.length<2||input.length>20)throw new Error('Keep 2 to 20 meeting types, including L10 and One-on-one.')
 const ids:string[]=[],names:string[]=[]
 const types=input.map(value=>{
  if(!value||typeof value.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(value.id)||ids.includes(value.id))throw new Error('Each meeting type needs a unique ID.')
  ids.push(value.id)
  if(typeof value.name!=='string'||!value.name.trim()||value.name.trim().length>80||names.includes(value.name.trim().toLowerCase()))throw new Error('Use a different name for each meeting type (up to 80 characters).')
  names.push(value.name.trim().toLowerCase())
  if(value.scope!=='team'&&value.scope!=='private')throw new Error('Choose team or private visibility.')
  if(!Array.isArray(value.sections)||value.sections.length<1||value.sections.length>20)throw new Error('Each agenda needs 1 to 20 sections.')
  const sectionIds:string[]=[]
  const sections:LiveSection[]=value.sections.map((section:any)=>{
   if(!section||typeof section.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(section.id)||sectionIds.includes(section.id))throw new Error('Each agenda section needs a unique ID.')
   sectionIds.push(section.id)
   if(typeof section.label!=='string'||!section.label.trim()||section.label.trim().length>120)throw new Error('Each section needs a name (up to 120 characters).')
   if(!Number.isInteger(section.minutes)||section.minutes<1||section.minutes>240)throw new Error('Section time must be a whole number from 1 to 240 minutes.')
   if(!sectionKinds.includes(section.kind))throw new Error('Choose supported section content.')
   if(section.prompt!==undefined&&(typeof section.prompt!=='string'||section.prompt.length>2000))throw new Error('Section prompts must be 2000 characters or fewer.')
   return {id:section.id,label:section.label.trim(),kind:section.kind,minutes:section.minutes,prompt:section.prompt || '',spentMs:0}
  })
  if(sections.filter(section=>section.kind==='conclude').length!==1||sections[sections.length-1].kind!=='conclude')throw new Error('Keep exactly one Conclusion section, at the end.')
  if(sections.reduce((sum,section)=>sum+section.minutes,0)>480)throw new Error('An agenda cannot exceed 480 minutes.')
  return {id:value.id,name:value.name.trim(),scope:value.scope as 'team'|'private',sections}
 })
 if(!types.some(type=>type.id==='l10'&&type.scope==='team')||!types.some(type=>type.id==='one-on-one'&&type.scope==='private'))throw new Error('Keep L10 as a team type and One-on-one as a private type.')
 return types
}

export interface SharedL10 {rev:number;type:MeetingType}
export function withSharedL10(catalog:MeetingTypeCatalog,shared?:SharedL10|null):MeetingTypeCatalog {
 return {...catalog,l10Rev:shared?.rev||0,types:catalog.types.map(type=>type.id==='l10'&&shared?shared.type:type)}
}
export function changedSharedL10(current:MeetingTypeCatalog,input:MeetingTypeCatalog):MeetingType|null {
 if((input.l10Rev||0)!==(current.l10Rev||0))throw new Error('The shared L10 format changed. Reload before saving.')
 const next=validateMeetingTypes(input.types).find(type=>type.id==='l10')!
 const before=validateMeetingTypes(current.types).find(type=>type.id==='l10')!
 return JSON.stringify(next)===JSON.stringify(before)?null:next
}
