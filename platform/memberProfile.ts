export interface MemberProfile {preferredName:string;photo:string;rev:number;updatedAt?:string}
export const MAX_PROFILE_PHOTO_LENGTH=131072
export function profileTarget(actorId:string,isAdmin:boolean,requested:unknown,adminAction:boolean):string {
 if(!actorId)throw new Error('A staff account is required.')
 if(adminAction){if(!isAdmin)throw new Error('Administrator access is required.');if(typeof requested!=='string'||!requested)throw new Error('Choose a current staff member.');return requested}
 if(requested!==undefined&&requested!==actorId)throw new Error('You can edit only your own profile.')
 return actorId
}
export function validateProfilePhoto(photo:unknown):string {
 if(photo==='')return ''
 if(typeof photo!=='string'||photo.length>MAX_PROFILE_PHOTO_LENGTH||!/^data:image\/jpeg;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(photo))throw new Error('Use a JPEG thumbnail smaller than 96 KB.')
 const encoded=photo.slice(23),alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',bytes:number[]=[]
 for(let i=0;i<encoded.length;i+=4){const a=alphabet.indexOf(encoded[i]),b=alphabet.indexOf(encoded[i+1]),c=alphabet.indexOf(encoded[i+2]),d=alphabet.indexOf(encoded[i+3]);bytes.push((a<<2)|(b>>4));if(c>=0)bytes.push(((b&15)<<4)|(c>>2));if(d>=0)bytes.push(((c&3)<<6)|d)}
 if(bytes.length<12||bytes.length>98304||bytes[0]!==255||bytes[1]!==216||bytes[bytes.length-2]!==255||bytes[bytes.length-1]!==217)throw new Error('The photo is not a valid JPEG thumbnail.')
 let position=2,dimensions=false,scan=false
 while(position<bytes.length-2){
  if(bytes[position++]!==255)throw new Error('The photo has an invalid JPEG header.')
  while(bytes[position]===255)position++
  const marker=bytes[position++];if(marker===218){const scanSize=(bytes[position]<<8)|bytes[position+1];if(scanSize<6||position+scanSize>=bytes.length-2)throw new Error('The photo has an invalid JPEG scan.');scan=true;break}if(marker===217)break
  if(marker===1||(marker>=208&&marker<=215))continue
  const size=(bytes[position]<<8)|bytes[position+1]
  if(size<2||position+size>bytes.length)throw new Error('The photo has an invalid JPEG segment.')
  if([192,193,194,195,197,198,199,201,202,203,205,206,207].indexOf(marker)>=0){
   if(size<8)throw new Error('The photo has an invalid JPEG frame.')
   const height=(bytes[position+3]<<8)|bytes[position+4],width=(bytes[position+5]<<8)|bytes[position+6]
   if(width<1||height<1||width>256||height>256)throw new Error('The profile photo must be 256 pixels or smaller.')
   dimensions=true
  }
  position+=size
 }
 if(!dimensions||!scan)throw new Error('The photo has no valid JPEG frame and scan.')
 return photo
}
export function validateMemberProfile(value:unknown):Pick<MemberProfile,'preferredName'|'photo'> {
 if(!value||typeof value!=='object')throw new Error('A profile is required.')
 const profile=value as Partial<MemberProfile>
 if(typeof profile.preferredName!=='string'||profile.preferredName.length>80||/[\u0000-\u001f\u007f<>]/.test(profile.preferredName))throw new Error('Use a preferred name of 80 characters or fewer.')
 return {preferredName:profile.preferredName.trim(),photo:validateProfilePhoto(profile.photo)}
}
export function saveMemberProfile(current:MemberProfile|undefined,input:unknown,expectedRev:unknown,updatedAt:string):MemberProfile {
 if(typeof expectedRev!=='number'||!Number.isInteger(expectedRev)||expectedRev!==(current?.rev||0))throw new Error('This profile changed. Reload before saving.')
 return {...validateMemberProfile(input),rev:(current?.rev||0)+1,updatedAt}
}
export function profileFirstName(fullName:string,preferredName=''):string {
 if(preferredName.trim())return preferredName.trim().split(/\s+/)[0]
 const name=fullName.trim();if(!name)return 'Unassigned'
 const comma=name.indexOf(',');const normal=comma>0&&!/\b(?:ph\.?d|lmhc|md|lcsw|rn)\b/i.test(name.slice(comma+1))?name.slice(comma+1).trim()+' '+name.slice(0,comma).trim():name
 return normal.split(/\s+/)[0]
}
