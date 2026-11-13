import {createContext,useContext} from 'react'
import type {MemberProfile} from '../../../platform/memberProfile'
import {profileFirstName} from '../../../platform/memberProfile'
export interface ProfilePerson {id:string;name:string}
interface ProfileDisplay {enabled:boolean;profiles:Record<string,MemberProfile>;people:ProfilePerson[]}
export const MemberProfilesContext=createContext<ProfileDisplay>({enabled:false,profiles:{},people:[]})
export function useMemberDisplay(id?:string,name?:string){
 const directory=useContext(MemberProfilesContext)
 const canonical=(value:string)=>value.toLowerCase().replace(/,/g,' ').split(/\s+/).filter(Boolean).sort().join(' ')
 let person=directory.people.find(person=>person.id===id)
 if(!person&&name){const matches=directory.people.filter(person=>canonical(person.name)===canonical(name));if(matches.length===1)person=matches[0]}
 const profile=directory.profiles[person?.id||id||''],fullName=person?.name||name||''
 return {fullName,photo:directory.enabled?profile?.photo||'':'',displayName:directory.enabled?profileFirstName(fullName,profile?.preferredName||''):fullName,preferredName:profile?.preferredName||'',enabled:directory.enabled}
}
export function useNameForSort(){
 const directory=useContext(MemberProfilesContext)
 return (id?:string,name?:string)=>{const person=directory.people.find(p=>p.id===id),full=person?.name||name||'';return directory.enabled?profileFirstName(full,directory.profiles[id||'']?.preferredName||''):full}
}
