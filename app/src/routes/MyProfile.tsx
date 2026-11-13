import {useEffect,useState} from 'react'
import type {ChangeEvent} from 'react'
import {getMemberProfile,saveMemberProfile} from '../api'
import type {MemberProfileReply} from '../api'
import {useApp} from '../state'
import {ErrorBanner,Loading} from '../lib/ui'
import {validateProfilePhoto} from '../../../platform/memberProfile'

export async function thumbnail(file:File):Promise<string>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPEG, PNG, or WebP photo.')
 if(file.size>5*1024*1024)throw new Error('Choose a photo smaller than 5 MB.')
 const url=URL.createObjectURL(file)
 try{
  const image=new Image();image.src=url;await image.decode()
  if(!image.width||!image.height||image.width*image.height>40000000)throw new Error('Choose a smaller photo.')
  const ratio=Math.min(1,256/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio))
  const context=canvas.getContext('2d');if(!context)throw new Error('This browser cannot prepare the photo.')
  context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height)
  return validateProfilePhoto(canvas.toDataURL('image/jpeg',.82))
 }finally{URL.revokeObjectURL(url)}
}
export default function MyProfile({personId,onSaved,embedded=false}:{personId?:string;onSaved?:()=>void;embedded?:boolean}){
 const {me,reload}=useApp()
 return <MemberProfileEditor personId={personId} embedded={embedded} fallbackName={me.name} onSaved={()=>{reload();onSaved?.()}}/>
}
export function MemberProfileEditor({personId,onSaved,embedded=false,fallbackName=''}:{personId?:string;onSaved?:()=>void;embedded?:boolean;fallbackName?:string}){
 const [saved,setSaved]=useState<MemberProfileReply|null>(null),[preferredName,setPreferredName]=useState(''),[photo,setPhoto]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState('')
 useEffect(()=>{let active=true;setSaved(null);setError('');getMemberProfile(personId).then(result=>{if(active){setSaved(result);setPreferredName(result.profile.preferredName);setPhoto(result.profile.photo)}}).catch(error=>{if(active)setError(error.message)});return()=>{active=false}},[personId])
 const changed=!!saved&&(photo!==saved.profile.photo||preferredName!==saved.profile.preferredName)
 const save=async()=>{
  if(!saved||busy)return;setBusy(true);setError('');setStatus('')
  try{const result=await saveMemberProfile({preferredName,photo,rev:saved.profile.rev},personId);setSaved(result);setPreferredName(result.profile.preferredName);setPhoto(result.profile.photo);setStatus('Profile saved.');onSaved?.()}
  catch(error){setError((error as Error).message)}finally{setBusy(false)}
 }
 const choosePhoto=async(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;setBusy(true);setError('');setStatus('');try{setPhoto(await thumbnail(file))}catch(error){setError((error as Error).message)}finally{setBusy(false)}}
 return <section className={embedded?'member-profile':'page member-profile'} aria-label={personId?'Member profile':'My Profile'}><div className="page__head"><div><h1>{personId?'Member profile':'My Profile'}</h1><p className="page__sub">Your preferred name and photo appear on your assigned items.</p></div></div><ErrorBanner error={error}/>{!saved?(!error&&<Loading what="Loading profile"/>):<div className="card card__body" style={{maxWidth:600}}>
  <p><strong>{saved.fullName||fallbackName}</strong></p><p className="muted">Your full name stays available in assignment choices and tooltips. Changing your profile does not change your staff record or team access.</p>
  <label className="field">Preferred first name<input className="input" value={preferredName} maxLength={80} disabled={busy} onChange={event=>{setPreferredName(event.target.value);setStatus('')}} placeholder="Use your current first name"/></label>
  <div className="profile-photo-preview">{photo?<img src={photo} alt="Selected profile photo"/>:<span className="avatar" aria-label="No profile photo">{(preferredName||saved.fullName||fallbackName).slice(0,1).toUpperCase()}</span>}</div>
  <label className="field">Profile photo<input type="file" aria-label="Profile photo" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>void choosePhoto(event)}/><span className="field__hint">JPEG, PNG, or WebP. Up to 5 MB. The app saves a small JPEG thumbnail.</span></label>
  {photo&&<button className="btn" disabled={busy} onClick={()=>{setPhoto('');setStatus('')}}>Remove photo</button>}
  <div style={{marginTop:16}}><button className="btn btn--primary" disabled={!changed||busy} onClick={()=>void save()}>{busy?'Saving…':'Save profile'}</button></div>
  <p role="status">{status|| (changed?'Unsaved changes.':'')}</p>
 </div>}</section>
}
