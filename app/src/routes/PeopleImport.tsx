import {useState} from 'react'
import type {PeopleImportPreview,PeopleImportRequest,ImportField} from '../../../platform/peopleImport'
import {ErrorBanner} from '../lib/ui'
import './peopleImport.css'
export interface PeopleImportProps {
 companies:{id:string;name:string}[];
 loadPreview:(companyId:string,fields:ImportField[])=>Promise<PeopleImportPreview>;
 applyPreview:(request:PeopleImportRequest&{scopeCompanyId:string})=>Promise<{noOp:boolean;appliedCount:number;rev:number;unresolvedIds:string[]}>;
}
export default function PeopleImport({companies,loadPreview,applyPreview}:PeopleImportProps){
 const [companyId,setCompanyId]=useState(''),[fields,setFields]=useState<ImportField[]>(['fullName','firstLast','email']),[preview,setPreview]=useState<PeopleImportPreview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[reviewed,setReviewed]=useState(false),[filter,setFilter]=useState('all'),[page,setPage]=useState(0)
 const reset=()=>{setPreview(null);setReviewed(false);setStatus('');setPage(0)}
 const selectFields=(group:ImportField[],checked:boolean)=>{setFields(current=>checked?Array.from(new Set([...current,...group])):current.filter(field=>!group.includes(field)));reset()}
 const read=async()=>{setBusy(true);setError('');setStatus('');setReviewed(false);setPage(0);try{setPreview(await loadPreview(companyId,fields))}catch(e){setPreview(null);setError((e as Error).message||'Could not read the source.')}finally{setBusy(false)}}
 const apply=async()=>{
  if(!preview||!reviewed||!preview.canApply||busy)return
  setBusy(true);setError('');setStatus('')
  try{const result=await applyPreview({scopeCompanyId:companyId,rev:preview.rev,token:preview.token,fields:preview.fields});setStatus(result.noOp?'No changes were needed.':`Saved ${result.appliedCount} source snapshot update${result.appliedCount===1?'':'s'}. ${result.unresolvedIds.length} unresolved item${result.unresolvedIds.length===1?'':'s'} retained for review.`);setPreview(null);setReviewed(false)}catch(e){setError((e as Error).message||'Could not apply the reviewed fields.')}finally{setBusy(false)}
 }
 const rows=preview?.rows.filter(row=>filter==='all'||row.status===filter)||[],pageCount=Math.max(1,Math.ceil(rows.length/30))
 return <section className="card people-import" aria-label="BlueStep source import"><div className="card__head"><h2>BlueStep source import</h2></div><div className="card__body">
  <p>Review source names and email before saving a separate source snapshot. This does not change staff records, preferred names, photos, team access, or invitations.</p>
  <ErrorBanner error={error}/><p role="status">{status}</p>
  <div className="people-import__controls"><label className="field">Company<select className="select" value={companyId} disabled={busy} onChange={event=>{setCompanyId(event.target.value);reset()}}><option value="">Select a company</option>{companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
  <fieldset disabled={busy}><legend>Fields to save</legend><label><input type="checkbox" checked={fields.includes('fullName')&&fields.includes('firstLast')} onChange={event=>selectFields(['fullName','firstLast'],event.target.checked)}/> Source names</label><label><input type="checkbox" checked={fields.includes('email')} onChange={event=>selectFields(['email'],event.target.checked)}/> Source email</label></fieldset>
  <button className="btn" disabled={busy||!companyId||!fields.length} onClick={()=>void read()}>{busy?'Working…':'Review source changes'}</button></div>
  <p className="muted">Only stable staff IDs are matched. Similar names or email addresses do not merge people. Missing people are retained. Phone and employment status are not imported. Ordinary directory contact links remain off until source permissions are verified.</p>
  {preview&&<>
   {!preview.complete&&<div className="banner banner--warn">The source is incomplete. Only the valid rows shown here can be saved. No missing person is removed or deactivated.</div>}
   {preview.errors.length>0&&<details><summary>Source warnings ({preview.errors.length})</summary><ul>{preview.errors.map((message,index)=><li key={index}>{message}</li>)}</ul></details>}
   {preview.blockedReason&&<p className="banner banner--warn">{preview.blockedReason}</p>}
   <div className="people-import__counts" aria-label="Source change counts">{(['new','changed','unchanged','unmatched','conflict'] as const).map(kind=><span key={kind}><strong>{preview.counts[kind]}</strong> {kind}</span>)}</div>
   <p>{preview.changeCount} selected-field update{preview.changeCount===1?'':'s'} ready. {preview.recordCount} source records will be retained. Conflicts stay unresolved.</p>
   <label className="people-import__filter">Show<select className="select" value={filter} onChange={event=>{setFilter(event.target.value);setPage(0)}}><option value="all">All rows</option>{['new','changed','unchanged','unmatched','conflict'].map(kind=><option key={kind} value={kind}>{kind}</option>)}</select></label>
   <div className="people-import__table"><table><thead><tr><th>Staff ID</th><th>Result</th><th>Saved source values</th><th>Current source values</th></tr></thead><tbody>{rows.slice(page*30,page*30+30).map(row=><tr key={row.id}><td>{row.id}</td><td>{row.status}{row.reason&&<p className="muted">{row.reason}</p>}</td><td>{row.before?<><span>{row.before.fullName||row.before.firstLast||'Name not set'}</span><br/><span>{row.before.email||'Email not set'}</span></>:'No saved source record'}</td><td>{row.after?<><span>{row.after.fullName||row.after.firstLast||'Name not set'}</span><br/><span>{row.after.email||'Email not set'}</span></>:'Not in this source snapshot'}</td></tr>)}</tbody></table></div>
   <div className="people-import__paging"><button className="btn btn--sm" disabled={page===0} onClick={()=>setPage(value=>value-1)}>Previous page</button><span>Page {page+1} of {pageCount}</span><button className="btn btn--sm" disabled={page+1>=pageCount} onClick={()=>setPage(value=>value+1)}>Next page</button></div>
   {!preview.changeCount&&<p className="muted">No selected-field changes are ready. Nothing will be saved.</p>}
   <label className="people-import__review"><input type="checkbox" checked={reviewed} disabled={busy||!preview.canApply} onChange={event=>setReviewed(event.target.checked)}/> I reviewed the source changes and the selected fields.</label>
   <button className="btn btn--primary" disabled={busy||!reviewed||!preview.canApply} onClick={()=>void apply()}>Apply reviewed source fields</button>
  </>}
 </div></section>
}
