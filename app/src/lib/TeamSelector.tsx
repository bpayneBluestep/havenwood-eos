import {useApp} from '../state'

export default function TeamSelector() {
  const {company,companies,multiCompany,setCompanyId}=useApp()
  if(!multiCompany)return null
  const companyTeams=companies.filter(c=>(c.kind||'company')==='company')
  const customTeams=companies.filter(c=>c.kind==='custom')
  const option=(c:typeof company)=><option key={c.id} value={c.id}>{c.kind==='custom'?c.name:c.settings.displayName||c.name}{c.settings.eosActive?'':' (inactive)'}</option>
  return <select className="select" style={{width:'auto',maxWidth:240}} value={company.id} onChange={e=>setCompanyId(e.target.value)} aria-label="Team">
    {customTeams.length===0?companyTeams.map(option):<>{companyTeams.length>0&&<optgroup label="Company teams">{companyTeams.map(option)}</optgroup>}<optgroup label="Teams">{customTeams.map(option)}</optgroup></>}
  </select>
}
