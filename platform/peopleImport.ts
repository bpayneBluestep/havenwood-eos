import {previewPeople,sourcePerson} from './peopleDirectory'
import type {SourcePerson,SourceSnapshot,PeoplePreview} from './peopleDirectory'
export type ImportField='fullName'|'firstLast'|'email'
export interface PeopleImportBaseline {rev:number;people:SourcePerson[]}
export interface PeopleImportRequest {token:string;rev:number;fields:ImportField[]}
export interface PeopleImportPreview {
 token:string;rev:number;fields:ImportField[];rows:PeoplePreview['rows'];counts:PeoplePreview['counts'];complete:boolean;
 errors:string[];limits:string[];canApply:boolean;changeCount:number;recordCount:number;retainedCount:number;blockedReason:string;
}
export interface PeopleImportResult {baseline:PeopleImportBaseline;preview:PeopleImportPreview;noOp:boolean;appliedCount:number;unresolvedIds:string[]}
export const PEOPLE_IMPORT_FIELDS:ImportField[]=['fullName','firstLast','email']
function fieldsOf(input:unknown):ImportField[]{
 if(!Array.isArray(input)||!input.length||input.length>3||input.some(field=>PEOPLE_IMPORT_FIELDS.indexOf(field)<0))throw Error('Select permitted source name or email fields.')
 return PEOPLE_IMPORT_FIELDS.filter(field=>input.indexOf(field)>=0)
}
function baselineOf(value:PeopleImportBaseline):PeopleImportBaseline {
 if(!value||!Number.isInteger(value.rev)||value.rev<0||!Array.isArray(value.people)||value.people.length>20000)throw Error('Invalid source baseline.')
 return {rev:value.rev,people:value.people.map(sourcePerson).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)}
}
// Portable SHA-256 binds review to the exact source snapshot, field selection and baseline.
export function importDigest(input:string):string {
 const bytes:number[]=[]
 for(let i=0;i<input.length;i++){
  let code=input.charCodeAt(i)
  if(code>=0xd800&&code<=0xdbff&&i+1<input.length){const low=input.charCodeAt(i+1);if(low>=0xdc00&&low<=0xdfff){code=0x10000+((code-0xd800)<<10)+(low-0xdc00);i++}}
  if(code<0x80)bytes.push(code);else if(code<0x800)bytes.push(0xc0|(code>>6),0x80|(code&63));else if(code<0x10000)bytes.push(0xe0|(code>>12),0x80|((code>>6)&63),0x80|(code&63));else bytes.push(0xf0|(code>>18),0x80|((code>>12)&63),0x80|((code>>6)&63),0x80|(code&63))
 }
 const bitLength=bytes.length*8;bytes.push(128);while(bytes.length%64!==56)bytes.push(0)
 for(let i=7;i>=0;i--)bytes.push(i>=4?0:(bitLength>>>((i%4)*8))&255)
 const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]
 const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],rotate=(x:number,n:number)=>(x>>>n)|(x<<(32-n))
 for(let offset=0;offset<bytes.length;offset+=64){
  const w:number[]=[];for(let i=0;i<16;i++){const p=offset+i*4;w[i]=(bytes[p]<<24)|(bytes[p+1]<<16)|(bytes[p+2]<<8)|bytes[p+3]}
  for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(rotate(a,7)^rotate(a,18)^(a>>>3))+w[i-7]+(rotate(b,17)^rotate(b,19)^(b>>>10)))|0}
  let [a,b,c,d,e,f,g,z]=h
  for(let i=0;i<64;i++){const first=(z+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+k[i]+w[i])|0,second=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))|0;z=g;g=f;f=e;e=(d+first)|0;d=c;c=b;b=a;a=(first+second)|0}
  const next=[a,b,c,d,e,f,g,z];for(let i=0;i<8;i++)h[i]=(h[i]+next[i])|0
 }
 return h.map(value=>(value>>>0).toString(16).padStart(8,'0')).join('')
}
function prepare(source:SourceSnapshot,baseline:PeopleImportBaseline,fields:ImportField[]){
 const base=baselineOf(baseline),selected=fieldsOf(fields),snapshot:SourceSnapshot={people:source.people.map(sourcePerson).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),complete:source.complete===true,errors:source.errors.slice()}
 const preview=previewPeople(snapshot,base.people),next=base.people.map(person=>({...person}));let changes=0
 for(const row of preview.rows){if(!row.after||row.status==='conflict'||row.status==='unmatched')continue
  const existing=next.find(person=>person.id===row.id),merged:SourcePerson=existing?{...existing}:{id:row.id,fullName:'',firstLast:'',email:''}
  for(const field of selected)merged[field]=row.after[field]
  if(!existing||selected.some(field=>existing[field]!==merged[field])){changes++;if(existing)next[next.indexOf(existing)]=merged;else next.push(merged)}
 }
 next.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)
 const blockedReason=JSON.stringify(next).length>150000?'The source snapshot is too large for one saved batch. No changes can be applied.':''
 const token=importDigest(JSON.stringify({version:1,baseline:base,source:snapshot,fields:selected}))
 const result:PeopleImportPreview={token,rev:base.rev,fields:selected,rows:preview.rows,counts:preview.counts,complete:preview.complete,errors:preview.errors,limits:preview.limits,canApply:!blockedReason&&changes>0,changeCount:changes,recordCount:next.length,retainedCount:preview.rows.filter(row=>row.status==='unmatched').length,blockedReason}
 return {base,next,preview:result}
}
export function buildPeopleImportPreview(source:SourceSnapshot,baseline:PeopleImportBaseline,fields:ImportField[]):PeopleImportPreview{return prepare(source,baseline,fields).preview}
export function applyPeopleImport(source:SourceSnapshot,baseline:PeopleImportBaseline,request:PeopleImportRequest):PeopleImportResult {
 if(!request||request.rev!==baseline.rev)throw Error('The source baseline changed. Review a new preview.')
 const prepared=prepare(source,baseline,request.fields)
 if(typeof request.token!=='string'||request.token!==prepared.preview.token)throw Error('The source or selected fields changed. Review a new preview.')
 if(prepared.preview.blockedReason)throw Error(prepared.preview.blockedReason)
 const noOp=prepared.preview.changeCount===0
 return {baseline:{rev:prepared.base.rev+(noOp?0:1),people:prepared.next},preview:prepared.preview,noOp,appliedCount:prepared.preview.changeCount,unresolvedIds:prepared.preview.rows.filter(row=>row.status==='conflict'||row.status==='unmatched').map(row=>row.id)}
}
