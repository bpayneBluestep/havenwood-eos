import {describe,it,expect} from 'vitest'
import {effectiveIssueTeams,mergeIssueTeamSelection,canAccessMappedIssue} from './issueModel'
describe('independent issue team mappings',()=>{
 it('keeps legacy issues on their original team until mappings are saved',()=>{expect(effectiveIssueTeams(undefined,'original')).toEqual(['original'])})
 it('uses explicit mappings without forcing the storage team',()=>{expect(effectiveIssueTeams(['second','second'],'original')).toEqual(['second']);expect(effectiveIssueTeams([],'original')).toEqual([])})
 it('fails closed for malformed mappings',()=>{expect(effectiveIssueTeams('original','original')).toEqual([])})
 it('maps an issue only to another accessible team',()=>{expect(mergeIssueTeamSelection(['original'],['second'],['original','second'])).toEqual(['second'])})
 it('permits multiple mapped teams',()=>{expect(mergeIssueTeamSelection(['original'],['original','second'],['original','second'])).toEqual(['original','second'])})
 it('rejects new mappings outside the caller permissions',()=>{expect(()=>mergeIssueTeamSelection(['original'],['hidden'],['original'])).toThrow('only teams')})
 it('retains existing mappings to teams the editor cannot access',()=>{expect(mergeIssueTeamSelection(['original','hidden'],['original'],['original','second'])).toEqual(['hidden','original'])})
 it('rejects removing the last mapping',()=>{expect(()=>mergeIssueTeamSelection(['original'],[],['original'])).toThrow('at least one')})
 it('permits removing all visible mappings while preserving another existing mapping',()=>{expect(mergeIssueTeamSelection(['original','hidden'],[],['original'])).toEqual(['hidden'])})
 it.each([null,'second',[null],['']])('rejects malformed selection %s',value=>{expect(()=>mergeIssueTeamSelection(['original'],value,['original'])).toThrow()})
 it('lets a member of an assigned team access the single issue',()=>{expect(canAccessMappedIssue({assignedTeamIds:['second']},'original','second',['second'])).toBe(true)})
 it('revokes original-team access when its mapping is removed',()=>{expect(canAccessMappedIssue({assignedTeamIds:['second']},'original','original',['original'])).toBe(false)})
 it('rejects a caller who is not a member of the mapped team',()=>{expect(canAccessMappedIssue({assignedTeamIds:['second']},'original','second',['third'])).toBe(false)})
 it('does not leak private meeting issues through team mappings',()=>{expect(canAccessMappedIssue({meetingId:'private',assignedTeamIds:['second']},'original','second',['second'],true)).toBe(false);expect(canAccessMappedIssue({meetingId:'private'},'original','original',['original'],false)).toBe(false);expect(canAccessMappedIssue({meetingId:'private'},'original','original',['original'],true)).toBe(true)})
})
