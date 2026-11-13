import {useCallback,useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {useApp} from '../state'
import {getModuleContext,getModuleHistory,restoreModuleRecord} from '../api'
import type {ModuleEntity,ModuleKind,ModuleName} from '../../../platform/companyModules'
import {ErrorBanner,Modal,fmtDate} from '../lib/ui'
import './modules.css'
export const newModuleId=(prefix:string)=>`${prefix}_${crypto.randomUUID().replace(/-/g,'')}`
export function useModuleContext(module:ModuleName,initialCompanyId?:string){
 const {company}=useApp(),[context,setContext]=useState<Awaited<ReturnType<typeof getModuleContext>>|null>(null),[id,setId]=useState(initialCompanyId||company.homeId||company.id),[contextId,setContextId]=useState(''),[error,setError]=useState('')
 const load=useCallback(()=>{let active=true;setContext(null);setError('');getModuleContext(module,id).then(value=>{if(active){setContext(value);setContextId(id)}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[module,id])
 useEffect(()=>{if(initialCompanyId)setId(initialCompanyId)},[initialCompanyId]);
 useEffect(load,[load]);return {context:contextId===id?context:null,id,setId,error,reload:load}
}
export function ScopeBar({scope}:{scope:ReturnType<typeof useModuleContext>}){return <div className="module-scope"><label>Company<select className="select" value={scope.id} onChange={e=>scope.setId(e.target.value)}>{scope.context?.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><span className="muted">Company direction and team access are separate.</span></div>}
export function Restricted({admin}:{admin:boolean}){return <div className="card card__body"><h2>Access is restricted</h2><p>This company module is not shared with one of your teams.</p>{admin&&<Link className="btn" to="/admin">Set visibility in Teams &amp; settings → Settings</Link>}</div>}
export function RecordHistory({record,onClose,onRestored,canEdit}:{record:ModuleEntity;onClose:()=>void;onRestored:()=>void;canEdit:boolean}){
 const [rows,setRows]=useState<ModuleEntity[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{let active=true;getModuleHistory(record.companyId,record.kind,record.id).then(value=>{if(active)setRows(value.records)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[record.companyId,record.kind,record.id])
 return <Modal title="Revision history" onClose={onClose}><ErrorBanner error={error}/>{rows.slice().reverse().map(row=>{const snapshot=row.data.snapshot as ModuleEntity;return <div className="module-history" key={row.id}><span>Revision {snapshot.rev} · {fmtDate(row.createdAt)} · {snapshot.archived?'Archived':'Active'}</span>{canEdit&&snapshot.rev!==record.rev&&<button className="btn btn--sm" disabled={busy} onClick={async()=>{setBusy(true);try{await restoreModuleRecord({scopeCompanyId:record.companyId,kind:record.kind as ModuleKind,id:record.id,historyId:row.id,rev:record.rev});onRestored();onClose()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>Restore revision {snapshot.rev}</button>}</div>})}{!rows.length&&!error&&<p>No history available.</p>}</Modal>
}
