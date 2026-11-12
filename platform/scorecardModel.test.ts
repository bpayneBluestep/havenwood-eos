import {describe,it,expect} from 'vitest'
import {validateSourceUrl,assignedTeams,validateAssignments,canViewMeasurable,planSections,orderMeasurables,withTeamSection,alignScorePeriods} from './scorecardModel'
describe('scorecard source links',()=>{
 it('accepts plain http and https links',()=>{expect(validateSourceUrl(' https://example.com/report?week=1#source ')).toBe('https://example.com/report?week=1#source');expect(validateSourceUrl('http://example.com')).toBe('http://example.com');expect(validateSourceUrl('')).toBe('')})
 it.each(['javascript:alert(1)','data:text/html,example','file:///tmp/example','//example.com','https://example.com/with spaces','https://user:password@example.com','https://'])('rejects unsafe or malformed source %s',value=>{expect(()=>validateSourceUrl(value)).toThrow()})
})
describe('measurable team assignment',()=>{
 it('retains the source team and removes duplicate assignments',()=>{expect(assignedTeams('source',['second','source','second'])).toEqual(['source','second'])})
 it('allows adding accessible teams',()=>{expect(validateAssignments('source',['second'],['source'],['source','second'])).toEqual(['source','second'])})
 it('rejects a forged destination team',()=>{expect(()=>validateAssignments('source',['hidden'],['source'],['source','second'])).toThrow('Select only teams')})
 it('preserves an existing assignment after the editor loses access to that team',()=>{expect(validateAssignments('source',['existing'],['source','existing'],['source'])).toEqual(['source','existing'])})
 it('rejects malformed assignment payloads',()=>{for(const value of [null,'second',[null],['']])expect(()=>validateAssignments('source',value,[],['source'])).toThrow()})
 it('lets a source-only member see their source measurable',()=>{expect(canViewMeasurable('source',[],'source',['source'])).toBe(true)})
 it('lets a member of an assigned team see the shared measurable',()=>{expect(canViewMeasurable('source',['source','second'],'second',['second'])).toBe(true)})
 it('rejects a caller outside the requested team even if that team is assigned',()=>{expect(canViewMeasurable('source',['source','second'],'second',['third'])).toBe(false)})
 it('rejects guessing an unassigned team',()=>{expect(canViewMeasurable('source',['source','second'],'third',['third'])).toBe(false)})
 it('revokes shared access when the assignment is removed',()=>{expect(canViewMeasurable('source',['source'],'second',['second'])).toBe(false)})
})
describe('scorecard section edits',()=>{
 const rows=[{id:'one',rev:2,group:'Admissions'},{id:'two',rev:3,group:'Finance'},{id:'three',rev:5,group:'Admissions'}]
 const revisions=rows.map(({id,rev})=>({id,rev}))
 const sections=[{name:'Finance',newName:'Operations'},{name:'Admissions',newName:'Admissions'}]
 it('renames and reorders every row in one planned change',()=>{expect(planSections(rows,sections,revisions)).toEqual([{id:'one',group:'Admissions',order:1},{id:'two',group:'Operations',order:0},{id:'three',group:'Admissions',order:1}])})
 it('rejects stale revisions before producing any patches',()=>{expect(()=>planSections(rows,sections,[...revisions.slice(0,2),{id:'three',rev:4}])).toThrow('scorecard changed')})
 it('rejects added or removed rows',()=>{expect(()=>planSections([...rows,{id:'four',rev:0,group:'Other'}],sections,revisions)).toThrow();expect(()=>planSections(rows.slice(0,2),sections,revisions)).toThrow()})
 it('rejects duplicate resulting section names',()=>{expect(()=>planSections(rows,[{name:'Admissions',newName:'Finance'},{name:'Finance',newName:'finance'}],revisions)).toThrow('different name')})
 it('rejects missing, duplicate or invented sections',()=>{expect(()=>planSections(rows,sections.slice(0,1),revisions)).toThrow();expect(()=>planSections(rows,[sections[0],sections[0]],revisions)).toThrow();expect(()=>planSections(rows,[{name:'Invented',newName:'Other'},sections[0]],revisions)).toThrow()})
 it('rejects duplicate revision IDs',()=>{expect(()=>planSections(rows,sections,[revisions[0],revisions[0],revisions[2]])).toThrow()})
 it('keeps new measurables inside the existing section order',()=>{const data=[{id:'one',group:'Finance',groupOrder:0},{id:'new',group:'Admissions'},{id:'two',group:'Admissions',groupOrder:1}];expect(orderMeasurables(data).map(row=>row.id)).toEqual(['one','new','two']);expect(data[1]).not.toHaveProperty('groupOrder')})
})

describe('team-specific sections',()=>{
 it('changes only the selected team presentation and preserves assignment and source data',()=>{
  const definition={rev:2,title:'Example',group:'Original',assignedTeamIds:['source','second'],sourceUrl:'https://example.com',sectionByTeam:{source:{name:'Source section',order:1},second:{name:'Shared section',order:0}}}
  const changed=withTeamSection(definition,'second',{group:'Renamed shared section',order:2})
  expect(changed.sectionByTeam.source).toEqual({name:'Source section',order:1});expect(changed.sectionByTeam.second).toEqual({name:'Renamed shared section',order:2});expect(changed.assignedTeamIds).toEqual(['source','second']);expect(changed.sourceUrl).toBe('https://example.com');expect(changed.group).toBe('Original');expect(changed.rev).toBe(3);expect(definition.sectionByTeam.second.name).toBe('Shared section')
 })
})

describe('shared score calendars',()=>{
 it('keeps the source score key when displaying periods from another team calendar',()=>{
  const cells=[{periodKey:'2026-Q3',value:12},{periodKey:'2026-Q4',value:15}]
  expect(alignScorePeriods(cells,['2026-Q2','2026-Q3'])).toEqual([{periodKey:'2026-Q2',scorePeriodKey:'2026-Q3',value:12},{periodKey:'2026-Q3',scorePeriodKey:'2026-Q4',value:15}]);expect(cells[0].periodKey).toBe('2026-Q3')
 })
})
