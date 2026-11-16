export function canManageTeamMembers(team:any, personId:string):boolean {
 return !!team && !team.archivedAt && !!personId && Array.isArray(team.memberIds) && team.memberIds.indexOf(personId)>=0 && Array.isArray(team.adminIds) && team.adminIds.indexOf(personId)>=0
}
export function changeTeamAdmin(team:any, personId:string, enabled:boolean, currentStaff:boolean):string[] {
 if(!team || team.archivedAt) throw Error('Select an active team.')
 if(enabled && (!currentStaff || team.memberIds.indexOf(personId)<0)) throw Error('Select a current member of this team.')
 const ids=(Array.isArray(team.adminIds)?team.adminIds:[]).filter((id:string)=>id!==personId)
 if(enabled)ids.push(personId)
 return ids
}
