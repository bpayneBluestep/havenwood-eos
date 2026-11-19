import {describe,it,expect} from 'vitest'
import {archiveQuery,archivePage,archiveRestoreRequest,archiveRestoreDecision,ARCHIVE_TYPES,type ArchiveCandidate} from './teamArchive'
const row=(id:string,type='headline',at:string|null='2026-11-18'):ArchiveCandidate=>({visible:true,searchText:'Background detail',summary:{type,id,teamId:'team-a',title:'Example '+id,ownerId:'person-a',originalDate:'2026-11-01',archivedAt:at,sourceMeetingId:'session-a',meetingId:null,occurrenceDate:null,rev:2,canRestore:true}})
describe('team archive read policy',()=>{
 it('includes each supported family and keeps recap view-only',()=>{const result=archivePage(ARCHIVE_TYPES.map(type=>row(type,type)),archiveQuery({}));expect(result.total).toBe(6);expect(result.items.find(x=>x.type==='recap')?.canRestore).toBe(false)})
 it('excludes denied, personal and internal rows before search and counts',()=>{expect(archivePage([{...row('denied'),visible:false},{...row('personal','todo'),personal:true},row('notes','live_team_notes')],archiveQuery({search:'Background'})).total).toBe(0)})
 it('deduplicates mapped source identity and projects only safe summaries',()=>{const candidate=row('shared','issue');Object.assign(candidate.summary,{dataJSON:{secret:'private'},notes:'private',email:'private'});const result=archivePage([candidate,candidate],archiveQuery({}));expect(result.total).toBe(1);expect(result.items[0]).not.toHaveProperty('dataJSON');expect(result.items[0]).not.toHaveProperty('notes');expect(result.items[0]).not.toHaveProperty('email')})
 it('filters title/details, owner, type, inclusive dates and meeting',()=>{const candidates=[row('one','rock'),row('two','issue')];expect(archivePage(candidates,archiveQuery({type:'rock',ownerId:'person-a',search:'background',from:'2026-11-18',to:'2026-11-18',meetingId:'session-a'})).items.map(x=>x.id)).toEqual(['one']);expect(archivePage(candidates,archiveQuery({ownerId:'outsider'})).total).toBe(0);expect(archivePage(candidates,archiveQuery({meetingId:'other'})).total).toBe(0)})
 it('sorts newest first with stable ties, unknown dates last and bounded pages',()=>{const candidates=[row('b'),row('unknown','headline',null),row('old','headline','2026-10-01'),row('a')];expect(archivePage(candidates,archiveQuery({limit:1,offset:1}))).toMatchObject({total:4,hasMore:true,items:[{id:'b'}]});expect(archivePage(candidates,archiveQuery({order:'asc'})).items.map(x=>x.id)).toEqual(['old','a','b','unknown']);expect(archivePage(candidates,archiveQuery({from:'2026-01-01'})).total).toBe(3)})
 it('fails closed on malformed filters and paging',()=>{for(const input of [{type:'everything'},{type:['rock']},{ownerId:{}},{meetingId:{}},{search:'x'.repeat(201)},{from:'2026-02-30'},{from:'2026-12-01',to:'2026-01-01'},{order:'sideways'},{limit:101},{limit:0},{offset:-1},{offset:100001},{offset:'1.5'}])expect(()=>archiveQuery(input)).toThrow()})
 it('retains denied restore capability and does not serialize search detail',()=>{const candidate=row('one');candidate.summary.canRestore=false;expect(archivePage([candidate],archiveQuery({})).items[0].canRestore).toBe(false);expect(archivePage([candidate],archiveQuery({})).items[0]).not.toHaveProperty('searchText')})
})

describe('team archive restore policy',()=>{
 const request=()=>archiveRestoreRequest({type:'issue',id:'shared-source',companyId:'team-a',rev:3});
 const state=()=>({visible:true,editable:true,writable:true,archivedAt:'2026-11-18',rev:3});
 it('requires a known restorable family, team, source ID and strict revision',()=>{
  for(const input of [{type:'recap'},{type:'live_team_notes'},{rev:null},{rev:''},{rev:-1},{rev:1.5},{rev:true},{rev:{}},{rev:'3x'},{id:''},{companyId:''},{patch:{status:'open'}},{form:'eosTodos'},{ownerId:'other'},{teamId:'other'}])expect(()=>archiveRestoreRequest({...request(),...input})).toThrow();
  expect(archiveRestoreRequest({...request(),rev:'3'})).toEqual(request());
 });
 it('allows existing sources in each family without a replacement identity',()=>{
  for(const type of ARCHIVE_TYPES.filter(x=>x!=='recap'))expect(archiveRestoreDecision({...request(),type},state()).code).toBe('OK');
  expect(request().id).toBe('shared-source');
 });
 it('rejects hidden, private-denied, personal and internal sources before revision disclosure',()=>{
  for(const denied of [{visible:false},{personal:true},{internal:true}])expect(archiveRestoreDecision(request(),{...state(),...denied,rev:99})).toEqual({code:'NOT_FOUND',warning:null});
  expect(archiveRestoreDecision({...request(),type:'recap'},state()).code).toBe('NOT_FOUND');
 });
 it('requires application edit rights and actual source/field write rights',()=>{
  for(const denied of [{editable:false},{writable:false}])expect(archiveRestoreDecision(request(),{...state(),...denied})).toEqual({code:'FORBIDDEN',warning:null});
 });
 it('rejects stale and repeated requests without a mutation plan',()=>{
  expect(archiveRestoreDecision(request(),{...state(),rev:4}).code).toBe('STALE');
  expect(archiveRestoreDecision(request(),{...state(),archivedAt:null}).code).toBe('ALREADY_RESTORED');
 });
 it('does not change completion, mappings, private attendance or saved history',()=>{
  const source={...state(),status:'done',readDate:'2026-11-17',assignedTeamIds:['team-a','team-b'],attendeeIds:['person-a'],archiveSource:{sessionId:'past'},completionArchive:{items:['retained']}};
  const before=JSON.stringify(source);archiveRestoreDecision(request(),source);expect(JSON.stringify(source)).toBe(before);
 });
 it('warns about shared Issue impact without returning team identities',()=>{
  const result=archiveRestoreDecision(request(),{...state(),sharedIssue:true});expect(result.warning).toBe('This restores the same Issue for all teams mapped to it.');expect(result).not.toHaveProperty('assignedTeamIds');
  expect(archiveRestoreDecision({...request(),type:'rock'},{...state(),sharedIssue:true}).warning).toBeNull();
 });
});
