export const ARCHIVE_TYPES = ['headline','todo','issue','rock','meeting','recap'];
export interface ArchiveQuery {type:string; search:string; ownerId:string; from:string; to:string; meetingId:string; order:string; offset:number; limit:number}
export interface ArchiveSummary {type:string; id:string; teamId:string; title:string; ownerId:string; originalDate:string|null; archivedAt:string|null; sourceMeetingId:string|null; meetingId:string|null; occurrenceDate:string|null; rev:number; canRestore:boolean}
export interface ArchiveCandidate {summary:ArchiveSummary; visible:boolean; personal?:boolean; searchText?:string}
function text(v:any):string {return typeof v==='string'?v:'';}
function date(v:any):boolean {if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const parts=v.split('-').map(Number),y=parts[0],m=parts[1],d=parts[2];const days=[31,y%4===0&&(y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];return y>=1&&m>=1&&m<=12&&d>=1&&d<=days[m-1];}
export function archiveQuery(input:any):ArchiveQuery {
 const get=(key:string)=>{const v=input[key];if(v===undefined||v===null||v==='')return '';if(typeof v!=='string')throw new Error('Invalid archive '+key+'.');return v;};
 const type=get('type'),search=get('search').trim(),ownerId=get('ownerId'),from=get('from'),to=get('to'),meetingId=get('meetingId'),order=get('order')||'desc';
 if((type&&ARCHIVE_TYPES.indexOf(type)<0)||search.length>200||ownerId.length>160||meetingId.length>160||(from&&!date(from))||(to&&!date(to))||(from&&to&&from>to)||['asc','desc'].indexOf(order)<0)throw new Error('Invalid archive filters.');
 const integer=(key:string,fallback:number,max:number)=>{const v=input[key];if(v===undefined||v===null||v==='')return fallback;if((typeof v!=='number'&&typeof v!=='string')||!/^\d+$/.test(String(v)))throw new Error('Invalid archive paging.');const n=Number(v);if(!isFinite(n)||n>max)throw new Error('Invalid archive paging.');return n;};
 const offset=integer('offset',0,100000),limit=integer('limit',25,100);if(limit<1)throw new Error('Invalid archive page size.');
 return {type,search,ownerId,from,to,meetingId,order,offset,limit};
}
export function archivePage(candidates:ArchiveCandidate[],query:ArchiveQuery):{items:ArchiveSummary[];total:number;offset:number;limit:number;hasMore:boolean} {
 const seen:{[key:string]:boolean}={},rows:ArchiveSummary[]=[];
 candidates.forEach(candidate=>{
  if(!candidate.visible||candidate.personal)return;
  const s=candidate.summary,key=s.type+'|'+s.id;
  if(ARCHIVE_TYPES.indexOf(s.type)<0||!s.id||seen[key])return;
  if(query.type&&s.type!==query.type||query.ownerId&&s.ownerId!==query.ownerId||query.meetingId&&s.sourceMeetingId!==query.meetingId&&s.meetingId!==query.meetingId)return;
  if(query.from&&(!s.archivedAt||s.archivedAt.slice(0,10)<query.from)||query.to&&(!s.archivedAt||s.archivedAt.slice(0,10)>query.to))return;
  if(query.search&&(s.title+' '+text(candidate.searchText)).toLowerCase().indexOf(query.search.toLowerCase())<0)return;
  seen[key]=true;
  // Explicit projection prevents internal memo or contact fields from escaping.
  rows.push({type:s.type,id:s.id,teamId:s.teamId,title:s.title,ownerId:s.ownerId,originalDate:s.originalDate,archivedAt:s.archivedAt,sourceMeetingId:s.sourceMeetingId,meetingId:s.meetingId,occurrenceDate:s.occurrenceDate,rev:s.rev,canRestore:s.type!=='recap'&&s.canRestore===true});
 });
 rows.sort((a,b)=>{if(!a.archivedAt&&b.archivedAt)return 1;if(a.archivedAt&&!b.archivedAt)return -1;const x=a.archivedAt||'',y=b.archivedAt||'';const order=x<y?-1:x>y?1:0;return order?(query.order==='asc'?order:-order):a.type<b.type?-1:a.type>b.type?1:a.id<b.id?-1:a.id>b.id?1:0;});
 return {items:rows.slice(query.offset,query.offset+query.limit),total:rows.length,offset:query.offset,limit:query.limit,hasMore:query.offset+query.limit<rows.length};
}

export interface ArchiveRestoreRequest {type:string; id:string; companyId:string; rev:number}
export interface ArchiveRestoreState {visible:boolean; editable:boolean; writable:boolean; archivedAt:any; rev:number; personal?:boolean; internal?:boolean; sharedIssue?:boolean}
export function archiveRestoreRequest(input:any):ArchiveRestoreRequest {
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid restore request.');
 const allowed=['action','type','id','companyId','teamId','rev'];
 if(Object.keys(input).some(key=>allowed.indexOf(key)<0))throw new Error('Only the item, team and revision can be supplied.');
 const type=input.type,id=input.id,companyId=input.companyId||input.teamId,rev=input.rev;
 if(typeof type!=='string'||ARCHIVE_TYPES.indexOf(type)<0||type==='recap'||typeof id!=='string'||!id.trim()||id.length>160||typeof companyId!=='string'||!companyId.trim()||companyId.length>160||input.companyId&&input.teamId&&input.companyId!==input.teamId)throw new Error('Invalid archive item or team.');
 if((typeof rev!=='number'&&typeof rev!=='string')||!/^\d+$/.test(String(rev))||!isFinite(Number(rev))||Number(rev)>9007199254740991)throw new Error('A valid expected revision is required.');
 return {type,id,companyId,rev:Number(rev)};
}
export function archiveRestoreDecision(request:ArchiveRestoreRequest,state:ArchiveRestoreState):{code:string; warning:string|null} {
 if(!state.visible||state.personal||state.internal||request.type==='recap')return {code:'NOT_FOUND',warning:null};
 if(!state.editable||!state.writable)return {code:'FORBIDDEN',warning:null};
 if(state.rev!==request.rev)return {code:'STALE',warning:null};
 if(!state.archivedAt)return {code:'ALREADY_RESTORED',warning:null};
 return {code:'OK',warning:request.type==='issue'&&state.sharedIssue?'This restores the same Issue for all teams mapped to it.':null};
}
