// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {cleanup,render,screen,within,waitFor,fireEvent} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type {Issue,Rock,Measurable} from '../api'
const api=vi.hoisted(()=>({getIssues:vi.fn(),saveIssue:vi.fn(),getRocks:vi.fn(),getRocksBoard:vi.fn(),saveScorecardSections:vi.fn(),getScorecard:vi.fn(),saveMeasurable:vi.fn(),setScore:vi.fn()}))
const state=vi.hoisted(()=>({current:{} as any}))
vi.mock('../api',async()=>({...await vi.importActual('../api'),...api}))
vi.mock('../state',()=>({useApp:()=>state.current}))
import Issues from './Issues'
import Rocks from './Rocks'
import Scorecard,{SectionsModal} from './Scorecard'
const people=[{id:'a',name:'Owner A'},{id:'b',name:'Owner B'}]
const company={id:'source',name:'Source team',settings:{scorecardCadences:['weekly']},periods:{quarter:'2026-Q4'}}
const baseIssue:Issue={archivedAt:null,createdByName:'Owner A',rank:1,solution:null,solvedAt:null,id:'one',title:'Zulu issue',description:'Example issue description',ownerId:'b',priority:5,term:'short',status:'open',rev:4,createdDate:'2026-11-11',linkedTodoIds:[]}
const rock:Rock={quarterKey:'2026-Q4',companyRock:false,dueDate:null,archivedAt:null,completedAt:null,rollUp:false,id:'rock',title:'Example Rock',ownerId:'a',ownerName:'Owner A',status:'on_track',rev:1,description:'Long Rock description',notes:[],milestones:[{id:'milestone',title:'Example milestone',ownerId:'a',done:false,dueDate:'2099-01-01',completedAt:null}]}
const measurable:Measurable={active:true,archivedAt:null,displayOrder:999,escalate:false,id:'measure',title:'Example measurable',ownerId:'a',ownerName:'Owner A',rev:2,group:'Admissions',cadence:'weekly',goal:{op:'gte',target:1,target2:null},valueType:'number',cells:[],sourceTeamId:'source',assignedTeamIds:['source'],sourceUrl:'https://example.com/report'}
beforeEach(()=>{
 vi.clearAllMocks()
 state.current={company,team:people,me:{id:'a',name:'Owner A'},nameOf:(id:string)=>people.find(person=>person.id===id)?.name || '',companies:[company,{id:'second',name:'Second team'}],scorecardEditing:true,milestoneWorkflow:false,meetingWorkflow:false}
 api.getIssues.mockResolvedValue({rows:[baseIssue,{...baseIssue,id:'two',title:'Alpha issue',ownerId:'a',createdDate:'2026-11-10'}]})
 api.getRocks.mockResolvedValue({rows:[rock],counts:{companies:1}})
 api.getScorecard.mockResolvedValue({rows:[measurable,{...measurable,id:'measure2',title:'Second measure',group:'Finance'}],periods:['2026-11-09'],currentPeriod:'2026-11-09'})
 api.setScore.mockResolvedValue({});api.saveIssue.mockResolvedValue({});api.saveMeasurable.mockResolvedValue({});api.saveScorecardSections.mockResolvedValue({})
})
afterEach(cleanup)
describe('issue browser comments',()=>{
 it('edits text in the row and saves with the original revision',async()=>{
  render(<Issues/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Edit issue Zulu issue'}))
  expect(screen.queryByRole('dialog')).toBeNull()
  const form=screen.getByRole('form',{name:'Edit issue inline'})
  await user.clear(within(form).getByLabelText('Issue title'));await user.type(within(form).getByLabelText('Issue title'),'Updated issue')
  await user.clear(within(form).getByLabelText('Issue notes'));await user.type(within(form).getByLabelText('Issue notes'),'Updated notes')
  await user.click(within(form).getByRole('button',{name:'Save issue'}))
  await waitFor(()=>expect(api.saveIssue).toHaveBeenCalledWith(expect.objectContaining({id:'one',title:'Updated issue',description:'Updated notes',rev:4})))
 })
 it('retains entered text if save fails',async()=>{
  api.saveIssue.mockRejectedValue(new Error('Example conflict'))
  render(<Issues/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Edit issue Zulu issue'}))
  await user.type(screen.getByLabelText('Issue title'),' changed');await user.click(screen.getByRole('button',{name:'Save issue'}))
  await screen.findByText('Example conflict');expect((screen.getByLabelText('Issue title') as HTMLInputElement).value).toBe('Zulu issue changed')
 })
 it('cancels inline editing without a write',async()=>{
  render(<Issues/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Edit issue Zulu issue'}));await user.click(screen.getByRole('button',{name:'Cancel'}));expect(api.saveIssue).not.toHaveBeenCalled();expect(screen.queryByRole('form')).toBeNull()
 })
 it('puts details in the action column and uses the Solved label',async()=>{
  render(<Issues/>);await screen.findByRole('button',{name:'Edit issue Zulu issue'});const details=screen.getAllByRole('button',{name:'Show details'})[0];expect(details.closest('.issue-actions')).not.toBeNull();expect(screen.getAllByRole('button',{name:'Solved'})).toHaveLength(2);expect(screen.getByText(/IDS: Identify/)).toBeTruthy()
 })
 it('filters by person and sorts by topic and creation date',async()=>{
  render(<Issues/>);await screen.findByRole('button',{name:'Edit issue Zulu issue'});const user=userEvent.setup();await user.selectOptions(screen.getByLabelText('Sort issues'),'topic');expect(screen.getAllByRole('button',{name:/Edit issue/})[0].textContent).toBe('Alpha issue');await user.selectOptions(screen.getByLabelText('Sort issues'),'newest');expect(screen.getAllByRole('button',{name:/Edit issue/})[0].textContent).toBe('Zulu issue');await user.selectOptions(screen.getByLabelText('Person'),'a');expect(screen.queryByRole('button',{name:'Edit issue Zulu issue'})).toBeNull()
 })
 it('keeps read-only issues locked',async()=>{
  api.getIssues.mockResolvedValue({rows:[{...baseIssue,readOnly:true}]});render(<Issues/>);await screen.findByText('Zulu issue');expect(screen.queryByRole('button',{name:'Edit issue Zulu issue'})).toBeNull();expect(screen.queryByRole('button',{name:'Solved'})).toBeNull()
 })
})
describe('Rock browser comments',()=>{
 it('starts milestones and descriptions collapsed',async()=>{
  render(<Rocks/>);await screen.findByRole('button',{name:'Edit rock Example Rock'});expect(screen.queryByText('Example milestone')).toBeNull();const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'Show milestones'}));expect(screen.getByText('Example milestone')).toBeTruthy();const description=screen.getByText('Long Rock description');expect(description.hidden).toBe(true);await user.click(screen.getByRole('button',{name:'Show description'}));expect(description.hidden).toBe(false)
 })
 it('opens the text editor from the title',async()=>{
  render(<Rocks/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Edit rock Example Rock'}));expect(screen.getByRole('dialog',{name:'Edit rock'})).toBeTruthy()
 })
})
describe('scorecard browser comments',()=>{
 it('shows a safe source link and accessible team checkboxes',async()=>{
  render(<Scorecard/>);await screen.findByText('Example measurable');const link=screen.getByRole('link',{name:'Source material for Example measurable'});expect(link.getAttribute('href')).toBe('https://example.com/report');expect(link.getAttribute('rel')).toContain('noopener')
  const user=userEvent.setup();await user.click(screen.getAllByRole('button',{name:'Row actions'})[0]);await user.click(screen.getByRole('button',{name:'Edit measurable'}));expect((screen.getByRole('checkbox',{name:'Source team (source team)'}) as HTMLInputElement).disabled).toBe(true)
  await user.click(screen.getByRole('checkbox',{name:'Second team'}));await user.clear(screen.getByLabelText(/Source material link/));await user.type(screen.getByLabelText(/Source material link/),'https://example.com/new')
  await user.click(screen.getByRole('button',{name:'Save'}));await waitFor(()=>expect(api.saveMeasurable).toHaveBeenCalledWith(expect.objectContaining({sourceUrl:'https://example.com/new',assignedTeamIds:['source','second'],rev:2})))
 })
 it('writes a shared score using the source calendar key',async()=>{
  api.getScorecard.mockResolvedValue({rows:[{...measurable,cells:[{periodKey:'2026-11-09',scorePeriodKey:'2026-W46',value:12,status:'green',goal:measurable.goal,enteredBy:'a',at:''}]}],periods:['2026-11-09'],currentPeriod:'2026-11-09'});render(<Scorecard/>);const input=await screen.findByRole('spinbutton');fireEvent.change(input,{target:{value:'22'}});fireEvent.blur(input);await waitFor(()=>expect(api.setScore).toHaveBeenCalledWith('measure','2026-W46',22))
 })
 it('keeps definition controls unavailable to assigned-team-only viewers',async()=>{
  api.getScorecard.mockResolvedValue({rows:[{...measurable,readOnly:true}],periods:['2026-11-09'],currentPeriod:'2026-11-09'});render(<Scorecard/>);await screen.findByText('Example measurable');expect(screen.queryByRole('button',{name:'Row actions'})).toBeNull();expect(screen.getByText('Shared')).toBeTruthy()
 })
 it('reorders and renames sections with all row revisions',async()=>{
  render(<SectionsModal rows={[measurable,{...measurable,id:'second',group:'Finance',rev:3}]} companyId="source" cadence="weekly" onClose={()=>{}} onSaved={()=>{}}/>);const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'Move Finance up'}));await user.clear(screen.getByLabelText('Section name for Finance'));await user.type(screen.getByLabelText('Section name for Finance'),'Operations');await user.click(screen.getByRole('button',{name:'Save sections'}));await waitFor(()=>expect(api.saveScorecardSections).toHaveBeenCalledWith({companyId:'source',cadence:'weekly',sections:[{name:'Finance',newName:'Operations'},{name:'Admissions',newName:'Admissions'}],revisions:[{id:'measure',rev:2},{id:'second',rev:3}]}))
 })
 it('retains section edits after a conflict',async()=>{
  api.saveScorecardSections.mockRejectedValue(new Error('Reload the scorecard'))
  render(<SectionsModal rows={[measurable]} companyId="source" cadence="weekly" onClose={()=>{}} onSaved={()=>{}}/>);fireEvent.change(screen.getByLabelText('Section name for Admissions'),{target:{value:'Updated section'}});fireEvent.click(screen.getByRole('button',{name:'Save sections'}));await screen.findByText('Reload the scorecard');expect((screen.getByLabelText('Section name for Admissions') as HTMLInputElement).value).toBe('Updated section')
 })
})
