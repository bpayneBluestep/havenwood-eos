import {describe,it,expect} from 'vitest'
import {canManageTeamMembers,changeTeamAdmin} from './teamAdministration'
const team={memberIds:['member','other'],adminIds:['member'],archivedAt:null}
describe('team administration permissions',()=>{
 it('requires both membership and a grant on an active team',()=>{
 expect(canManageTeamMembers(team,'member')).toBe(true)
 for(const row of [null,{...team,adminIds:[]},{...team,memberIds:[]},{...team,archivedAt:'2026-01-01'}])expect(canManageTeamMembers(row,'member')).toBe(false)
 expect(canManageTeamMembers(team,'other')).toBe(false)
 expect(canManageTeamMembers({...team,memberIds:['member'],adminIds:['other']},'member')).toBe(false)
 })
 it('grants only to current members and permits revocation',()=>{
 expect(changeTeamAdmin(team,'other',true,true)).toEqual(['member','other'])
 expect(()=>changeTeamAdmin(team,'outsider',true,true)).toThrow()
 expect(()=>changeTeamAdmin(team,'other',true,false)).toThrow()
 expect(()=>changeTeamAdmin({...team,archivedAt:'2026-01-01'},'other',true,true)).toThrow()
 expect(changeTeamAdmin(team,'member',false,false)).toEqual([])
 expect(team.adminIds).toEqual(['member'])
 })
})
