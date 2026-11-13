import {useEffect,useState} from 'react'
import {getToolBranding,saveToolBranding} from '../api'
import {thumbnail} from './MyProfile'
import {ErrorBanner} from '../lib/ui'
export default function BrandingSettings({onSaved}:{onSaved:()=>void}){
 const [saved,setSaved]=useState<{logo:string;rev:number}|null>(null),[logo,setLogo]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('')
 useEffect(()=>{let active=true;getToolBranding().then(value=>{if(active){setSaved(value);setLogo(value.logo)}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[])
 return <section className="card card__body" aria-label="Tool logo"><h3>Tool logo</h3><p className="muted">Update the shared TenK logo. The name and BHAG stay the same.</p><ErrorBanner error={error}/>{saved&&<>
 <div className="tool-logo-preview">{logo?<img src={logo} alt="Logo preview"/>:<span className="nav__mark">10K</span>}</div>
 <label className="field">Upload logo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;setBusy(true);setError('');setStatus('');try{setLogo(await thumbnail(file))}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}/><span className="field__hint">JPEG, PNG, or WebP. Up to 5 MB. Saved as a small JPEG.</span></label>
 {logo&&<button className="btn" disabled={busy} onClick={()=>setLogo('')}>Use default logo</button>}
 <button className="btn btn--primary" disabled={busy||logo===saved.logo} onClick={async()=>{setBusy(true);setError('');try{const value=await saveToolBranding(logo,saved.rev);setSaved(value);setLogo(value.logo);setStatus('Logo saved.');onSaved()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>Save logo</button><p role="status">{status}</p></>}
 </section>
}
