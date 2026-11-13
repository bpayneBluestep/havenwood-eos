import {validModuleId} from './companyModules';
export interface SourcePerson {id:string;fullName:string;firstLast:string;email:string}
export interface SourceSnapshot {people:SourcePerson[];complete:boolean;errors:string[]}
export interface DirectoryPerson {id:string;source:SourcePerson|null;rosterName:string;profile:unknown;teamIds:string[];contactsVerified:boolean}
export interface DirectoryRoster {id:string;people:{id:string;name:string}[]}
export interface PreviewRow {id:string;status:'new'|'changed'|'unchanged'|'unmatched'|'conflict';before:SourcePerson|null;after:SourcePerson|null;reason?:string}
export interface PeoplePreview {rows:PreviewRow[];counts:Record<PreviewRow['status'],number>;complete:boolean;canApply:false;canDeactivate:false;errors:string[];limits:string[]}
const LIMITS=['Work phone is not bound.','Company/site employment mapping is not verified.','The source does not establish deactivation authority.','A preview does not grant access, invite people, or change local profiles.'];
function text(value:unknown,max:number):string {if(typeof value!=='string'||value.length>max)throw Error('Invalid source text.');return value;}
export function sourcePerson(raw:unknown):SourcePerson {if(!raw||typeof raw!=='object')throw Error('Invalid source person.');const p=raw as SourcePerson;if(!validModuleId(p.id))throw Error('Invalid staff ID.');return {id:p.id,fullName:text(p.fullName,500),firstLast:text(p.firstLast,500),email:text(p.email,500)};}
export function sourceSnapshot(rows:unknown[],complete:boolean,errors:string[]=[]):SourceSnapshot {
 if(!Array.isArray(rows)||rows.length>20000)throw Error('Source exceeds preview limit.');const people:SourcePerson[]=[];const issues=errors.slice();for(const row of rows){try{people.push(sourcePerson(row));}catch(error){issues.push(String((error as Error).message||error));}}
 return {people,complete:complete&&issues.length===0,errors:issues};
}
function same(a:SourcePerson,b:SourcePerson):boolean {return a.fullName===b.fullName&&a.firstLast===b.firstLast&&a.email===b.email;}
export function previewPeople(source:SourceSnapshot,baseline:SourcePerson[]):PeoplePreview {
 if(!Array.isArray(baseline)||baseline.length>20000)throw Error('Baseline exceeds preview limit.');const before=baseline.map(sourcePerson);const rows:PreviewRow[]=[];const ids:string[]=[];const incomingById:Record<string,SourcePerson[]>={},beforeById:Record<string,SourcePerson[]>={};
 for(const p of source.people){const key='id_'+p.id;if(!incomingById[key])incomingById[key]=[];incomingById[key].push(p);}for(const p of before){const key='id_'+p.id;if(!beforeById[key])beforeById[key]=[];beforeById[key].push(p);}
 for(const key in incomingById)ids.push(key.substring(3));for(const key in beforeById)if(!incomingById[key])ids.push(key.substring(3));ids.sort();
 const signatures:Record<string,string[]>={};for(const p of before)for(const pair of [['email:',p.email],['name:',p.fullName]]){const value=pair[1].trim().toLowerCase();if(!value)continue;const key=pair[0]+value;if(!signatures[key])signatures[key]=[];signatures[key].push(p.id);}
 for(const id of ids){const incoming=incomingById['id_'+id]||[],existing=beforeById['id_'+id]||[];const after=incoming[0]||null,prior=existing[0]||null;
 if(incoming.length>1||existing.length>1){rows.push({id,status:'conflict',before:prior,after,reason:'Duplicate immutable staff ID.'});continue;}
 if(!after){if(source.complete)rows.push({id,status:'unmatched',before:prior,after:null,reason:'Not in this snapshot. No deactivation is authorized.'});continue;}
 if(!prior&&[['email:',after.email],['name:',after.fullName]].some(pair=>{const value=pair[1].trim().toLowerCase();return !!value&&(signatures[pair[0]+value]||[]).some(other=>other!==id);})){rows.push({id,status:'conflict',before:null,after,reason:'A different staff ID has the same name or email. Manual review is required.'});continue;}
 rows.push({id,status:!prior?'new':same(prior,after)?'unchanged':'changed',before:prior,after});}
 const counts={new:0,changed:0,unchanged:0,unmatched:0,conflict:0};for(const row of rows)counts[row.status]++;
 return {rows,counts,complete:source.complete,canApply:false,canDeactivate:false,errors:source.errors.slice(),limits:LIMITS.slice()};
}
export function scopedDirectory(rosters:DirectoryRoster[],profiles:Record<string,unknown>,source:SourceSnapshot|undefined,contactsVerified=false):DirectoryPerson[]{
 const people:DirectoryPerson[]=[];for(const roster of rosters)for(const member of roster.people){if(!validModuleId(member.id))continue;let person=people.find(p=>p.id===member.id);if(!person){const matches=contactsVerified&&source?source.people.filter(p=>p.id===member.id):[];person={id:member.id,rosterName:member.name,source:matches.length===1?matches[0]:null,profile:Object.prototype.hasOwnProperty.call(profiles,member.id)?profiles[member.id]:null,teamIds:[],contactsVerified:contactsVerified&&matches.length===1};people.push(person);}if(person.teamIds.indexOf(roster.id)<0)person.teamIds.push(roster.id);}
 for(const person of people)person.teamIds.sort();return people.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
}
