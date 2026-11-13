// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {act,cleanup,render,screen,within,waitFor,fireEvent} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type {Issue,Rock,Measurable} from '../api'
const api=vi.hoisted(()=>({getIssues:vi.fn(),saveIssue:vi.fn(),getRocks:vi.fn(),getRocksBoard:vi.fn(),saveScorecardSections:vi.fn(),getScorecard:vi.fn(),saveMeasurable:vi.fn(),setScore:vi.fn(),getLiveSessions:vi.fn(),liveSessionAction:vi.fn(),getTodos:vi.fn(),getMy90:vi.fn(),saveMeeting:vi.fn(),getL10:vi.fn(),getMeetings:vi.fn(),getMeetingTypes:vi.fn(),adminMeetingTypes:vi.fn(),adminSaveMeetingTypes:vi.fn()}))
const state=vi.hoisted(()=>({current:{} as any}))
vi.mock('../api',async()=>({...await vi.importActual('../api'),...api}))
vi.mock('../state',()=>({useApp:()=>state.current}))
import {fmtValue} from '../lib/ui'
import LiveMeetings from '../meetings/LiveMeetings'
import Todos from './Todos'
import L10 from './L10'
import {MemoryRouter} from 'react-router-dom'
import Meetings,{MeetingForm} from './Meetings'
import My90 from './My90'
import MeetingTypesAdmin from '../meetings/MeetingTypesAdmin'
import {defaultMeetingTypes} from '../../../platform/meetingTypes'
import {defaultLiveSections} from '../../../platform/liveSessionModel'
import Issues,{IssuePriority} from './Issues'
import Rocks from './Rocks'
import Scorecard,{SectionsModal} from './Scorecard'
const people=[{id:'a',name:'Owner A'},{id:'b',name:'Owner B'}]
const company={id:'source',name:'Source team',settings:{scorecardCadences:['weekly']},periods:{quarter:'2026-Q4'}}
const baseIssue:Issue={archivedAt:null,createdByName:'Owner A',rank:1,solution:null,solvedAt:null,id:'one',title:'Zulu issue',description:'Example issue description',ownerId:'b',priority:5,term:'short',status:'open',rev:4,createdDate:'2026-11-11',linkedTodoIds:[]}
const rock:Rock={quarterKey:'2026-Q4',companyRock:false,dueDate:null,archivedAt:null,completedAt:null,rollUp:false,id:'rock',title:'Example Rock',ownerId:'a',ownerName:'Owner A',status:'on_track',rev:1,description:'Long Rock description',notes:[],milestones:[{id:'milestone',title:'Example milestone',ownerId:'a',done:false,dueDate:'2099-01-01',completedAt:null}]}
const measurable:Measurable={active:true,archivedAt:null,displayOrder:999,escalate:false,id:'measure',title:'Example measurable',ownerId:'a',ownerName:'Owner A',rev:2,group:'Admissions',cadence:'weekly',goal:{op:'gte',target:1,target2:null},valueType:'number',cells:[],sourceTeamId:'source',assignedTeamIds:['source'],sourceUrl:'https://example.com/report'}
beforeEach(()=>{
 vi.clearAllMocks()
 api.saveMeeting.mockResolvedValue({id:'created'});api.getMy90.mockResolvedValue({todos:[],rocks:[],milestones:[],measurables:[]});api.getMeetings.mockResolvedValue({rows:[]});api.getMeetingTypes.mockResolvedValue({rev:0,types:defaultMeetingTypes()});api.adminMeetingTypes.mockResolvedValue({rev:0,types:defaultMeetingTypes()});api.adminSaveMeetingTypes.mockImplementation(async(_team,catalog)=>({...catalog,rev:catalog.rev+1}))
 state.current={company,team:people,me:{id:'a',name:'Owner A'},nameOf:(id:string)=>people.find(person=>person.id===id)?.name || '',companies:[company,{id:'second',name:'Second team'}],scorecardEditing:true,milestoneWorkflow:false,meetingWorkflow:false}
 api.getIssues.mockResolvedValue({rows:[baseIssue,{...baseIssue,id:'two',title:'Alpha issue',ownerId:'a',createdDate:'2026-11-10'}]})
 api.getRocks.mockResolvedValue({rows:[rock],counts:{companies:1}})
 api.getScorecard.mockResolvedValue({rows:[measurable,{...measurable,id:'measure2',title:'Second measure',group:'Finance'}],periods:['2026-11-09'],currentPeriod:'2026-11-09'})
 api.getL10.mockResolvedValue({agenda:['Segue','Scorecard','Rock review','Headlines','Action Items','Issues','Conclusion'].map(label=>({label,minutes:5})),scorecard:{rows:[],periods:[]},rocks:[],headlines:[],todos:{rows:[],completed:0,total:0,pct:null,target:.9},issues:[]});
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
 it('filters by person and reverses name and creation-date sorting with buttons',async()=>{
  render(<Issues/>);await screen.findByRole('button',{name:'Edit issue Zulu issue'});const user=userEvent.setup();const controls=within(screen.getByRole('group',{name:'Sort issues'}));expect(controls.getAllByRole('button')).toHaveLength(3);expect(controls.queryByRole('combobox')).toBeNull()
  await user.click(controls.getByRole('button',{name:'Name'}));expect(screen.getAllByRole('button',{name:/Edit issue/})[0].textContent).toBe('Alpha issue');await user.click(controls.getByRole('button',{name:'Name'}));expect(screen.getAllByRole('button',{name:/Edit issue/})[0].textContent).toBe('Zulu issue')
  await user.click(controls.getByRole('button',{name:'Date'}));expect(screen.getAllByRole('button',{name:/Edit issue/})[0].textContent).toBe('Zulu issue');await user.click(controls.getByRole('button',{name:'Date'}));expect(screen.getAllByRole('button',{name:/Edit issue/})[0].textContent).toBe('Alpha issue')
  await user.selectOptions(screen.getByLabelText('Person'),'a');expect(screen.queryByRole('button',{name:'Edit issue Zulu issue'})).toBeNull()
 })
 it('sorts importance highest first and reverses to lowest first',async()=>{
  api.getIssues.mockResolvedValue({rows:[{...baseIssue,id:'low',title:'Low importance',priority:1},baseIssue,{...baseIssue,id:'none',title:'Unranked issue',priority:null}]});render(<Issues/>);await screen.findByRole('button',{name:'Edit issue Zulu issue'});const user=userEvent.setup();const controls=within(screen.getByRole('group',{name:'Sort issues'}));await user.click(controls.getByRole('button',{name:'Importance'}));expect(screen.getAllByRole('button',{name:/Edit issue/}).map(button=>button.textContent)).toEqual(['Zulu issue','Low importance','Unranked issue']);await user.click(controls.getByRole('button',{name:'Importance'}));expect(screen.getAllByRole('button',{name:/Edit issue/}).map(button=>button.textContent)).toEqual(['Low importance','Zulu issue','Unranked issue']);expect(controls.getByRole('button',{name:'Importance'}).getAttribute('aria-pressed')).toBe('true');expect(controls.getByRole('button',{name:'Name'}).getAttribute('aria-pressed')).toBe('false')
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

describe('shared meeting scorecard display',()=>{
 it('formats numbers, dollars, percentages and real zero without rescaling',()=>{
  expect(fmtValue(1282)).toBe('1,282');expect(fmtValue(1234.56,'currency')).toBe('$1,234.56');expect(fmtValue(-1234.56,'currency')).toBe('-$1,234.56');expect(fmtValue(.30,'percent')).toBe('0.3%');expect(fmtValue(100,'percent')).toBe('100%');expect(fmtValue(0)).toBe('0');expect(fmtValue(null)).toBe('')
 })
 it('uses the same grouped, editable scorecard inside a meeting',async()=>{
  render(<L10 embedded section="scorecard"/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Admissions'}));expect(screen.getByRole('dialog',{name:'Manage scorecard sections'})).toBeTruthy();expect(document.activeElement).toBe(screen.getByLabelText('Section name for Admissions'))
  await user.clear(screen.getByLabelText('Section name for Admissions'));await user.type(screen.getByLabelText('Section name for Admissions'),'Intake');await user.click(screen.getByRole('button',{name:'Save sections'}));await waitFor(()=>expect(api.saveScorecardSections).toHaveBeenCalledWith(expect.objectContaining({companyId:'source',cadence:'weekly',sections:expect.arrayContaining([{name:'Admissions',newName:'Intake'}])})))
 })
 it('saves the selected number display from the measurable title editor',async()=>{
  render(<Scorecard/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Example measurable'}));await user.selectOptions(screen.getByLabelText('Value'),'currency');expect(screen.getByText(/Display example:.*1,234.56/)).toBeTruthy();await user.click(screen.getByRole('button',{name:'Save'}));await waitFor(()=>expect(api.saveMeasurable).toHaveBeenCalledWith(expect.objectContaining({id:'measure',valueType:'currency',rev:2})))
 })
})

describe('direct issue ranking',()=>{
 it('saves a ranking from the list without opening an editor',async()=>{
  render(<Issues/>);const select=await screen.findByRole('combobox',{name:'Ranking for Zulu issue'});await userEvent.setup().selectOptions(select,'2');await waitFor(()=>expect(api.saveIssue).toHaveBeenCalledWith({companyId:'source',id:'one',rev:4,title:'Zulu issue',priority:2}));expect(screen.queryByRole('dialog')).toBeNull();expect(screen.queryByRole('form',{name:'Edit issue inline'})).toBeNull()
 })
 it('restores the original number and displays a failed-save error',async()=>{
  api.saveIssue.mockRejectedValue(new Error('Example revision conflict'));render(<Issues/>);const select=await screen.findByRole('combobox',{name:'Ranking for Zulu issue'});await userEvent.setup().selectOptions(select,'1');await screen.findByRole('alert');expect((select as HTMLSelectElement).value).toBe('5');expect(screen.getByText('Example revision conflict')).toBeTruthy()
 })
 it('disables ranking changes on read-only issues',()=>{
  render(<IssuePriority issue={{...baseIssue,readOnly:true}} companyId="source" onSaved={()=>{}}/>);expect((screen.getByRole('combobox',{name:'Ranking for Zulu issue'}) as HTMLSelectElement).disabled).toBe(true)
 })
 it('prevents another ranking write while a save is pending',async()=>{
  let finish:(value:unknown)=>void=()=>{};api.saveIssue.mockReturnValue(new Promise(resolve=>{finish=resolve}));render(<IssuePriority issue={baseIssue} companyId="source" onSaved={()=>{}}/>);const select=screen.getByRole('combobox',{name:'Ranking for Zulu issue'});await userEvent.setup().selectOptions(select,'3');expect((select as HTMLSelectElement).disabled).toBe(true);expect(api.saveIssue).toHaveBeenCalledTimes(1);finish({});await waitFor(()=>expect((select as HTMLSelectElement).disabled).toBe(false))
 })
 it('allows an unranked issue to receive a 1–5 ranking',async()=>{
  render(<IssuePriority issue={{...baseIssue,priority:null}} companyId="source" onSaved={()=>{}}/>);const select=screen.getByRole('combobox',{name:'Ranking for Zulu issue'});expect((select as HTMLSelectElement).value).toBe('');await userEvent.setup().selectOptions(select,'4');await waitFor(()=>expect(api.saveIssue).toHaveBeenCalledWith(expect.objectContaining({priority:4})))
 })
})

describe('issue team checkboxes',()=>{
 beforeEach(()=>{state.current.issueTeamMapping=true})
 it('shows only accessible teams and allows removing the original mapping in the modal',async()=>{
  render(<Issues/>);await screen.findByRole('button',{name:'Edit issue Zulu issue'});const user=userEvent.setup();await user.click(screen.getAllByRole('button',{name:'Row actions'})[0]);await user.click(screen.getByRole('button',{name:'Edit issue'}));const group=within(screen.getByRole('group',{name:'Issue team mappings'}));expect(group.getAllByRole('checkbox')).toHaveLength(2);expect(group.queryByRole('combobox')).toBeNull();await user.click(group.getByRole('checkbox',{name:'Source team'}));await user.click(group.getByRole('checkbox',{name:'Second team'}));await user.click(screen.getByRole('button',{name:'Save'}));await waitFor(()=>expect(api.saveIssue).toHaveBeenCalledWith(expect.objectContaining({id:'one',rev:4,assignedTeamIds:['second']})))
 })
 it('offers the same mappings in the inline editor',async()=>{
  render(<Issues/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Edit issue Zulu issue'}));await user.click(screen.getByRole('checkbox',{name:'Second team'}));await user.click(screen.getByRole('button',{name:'Save issue'}));await waitFor(()=>expect(api.saveIssue).toHaveBeenCalledWith(expect.objectContaining({assignedTeamIds:['source','second']})))
 })
 it('defaults new issues to the selected team and accepts additional teams',async()=>{
  render(<Issues/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'+ Issue'}));expect((screen.getByRole('checkbox',{name:'Source team'}) as HTMLInputElement).checked).toBe(true);await user.type(screen.getByLabelText('Issue',{exact:true}),'Example mapped issue');await user.click(screen.getByRole('checkbox',{name:'Second team'}));await user.click(screen.getByRole('button',{name:'Save'}));await waitFor(()=>expect(api.saveIssue).toHaveBeenCalledWith(expect.objectContaining({title:'Example mapped issue',assignedTeamIds:['source','second']})))
 })
 it('retains checkbox selections when a mapping save fails',async()=>{
  api.saveIssue.mockRejectedValue(new Error('Mapping save failed'));render(<Issues/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Edit issue Zulu issue'}));await user.click(screen.getByRole('checkbox',{name:'Second team'}));await user.click(screen.getByRole('button',{name:'Save issue'}));await screen.findByText('Mapping save failed');expect((screen.getByRole('checkbox',{name:'Second team'}) as HTMLInputElement).checked).toBe(true)
 })
 it('does not expose team mappings on private meeting issues',async()=>{
  api.getIssues.mockResolvedValue({rows:[{...baseIssue,meetingId:'private'}]});render(<Issues/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Edit issue Zulu issue'}));expect(screen.queryByRole('group',{name:'Issue team mappings'})).toBeNull();await user.click(screen.getByRole('button',{name:'Save issue'}));await waitFor(()=>expect(api.saveIssue).toHaveBeenCalled());expect(api.saveIssue.mock.calls[0][0]).not.toHaveProperty('assignedTeamIds')
 })
})

describe('live meetings and action items',()=>{
 const live=()=>({id:'live',companyId:'source',meetingId:'',date:'2026-11-12',title:'Example live meeting',hostId:'b',hostName:'Owner B',status:'running' as const,activeIndex:0,activeStartedAt:Date.now(),startedAt:Date.now(),endedAt:null,sections:defaultLiveSections(),rev:1,participants:[{userId:'b',name:'Owner B',joinedAt:1,rating:null,updatedAt:1}],joined:false,canControl:false,serverNow:Date.now()})
 it('joins an existing session from the lobby',async()=>{
  state.current.liveMeetings=true;const session=live();api.getLiveSessions.mockResolvedValue({sessions:[session],serverNow:Date.now()});api.liveSessionAction.mockResolvedValue({...session,joined:true,participants:[...session.participants,{userId:'a',name:'Owner A',joinedAt:2,rating:null,updatedAt:2}]});render(<LiveMeetings companyId="source"/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Join meeting'}));await waitFor(()=>expect(api.liveSessionAction).toHaveBeenCalledWith(expect.objectContaining({command:'join',sessionId:'live'})));expect(screen.getByRole('complementary',{name:'Meeting agenda'})).toBeTruthy();expect(screen.queryByRole('button',{name:'Next section'})).toBeNull()
 })
 it('starts a shared meeting and gives the facilitator timer controls',async()=>{
  state.current.liveMeetings=true;api.getLiveSessions.mockResolvedValue({sessions:[],serverNow:Date.now()});api.liveSessionAction.mockResolvedValue({...live(),hostId:'a',hostName:'Owner A',joined:true,canControl:true});render(<LiveMeetings companyId="source"/>);const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'Start a meeting'}));await screen.findByRole('button',{name:'Next section'});expect(api.liveSessionAction).toHaveBeenCalledWith(expect.objectContaining({command:'start',companyId:'source'}));await user.click(screen.getByRole('button',{name:'Pause'}));await waitFor(()=>expect(api.liveSessionAction).toHaveBeenCalledWith(expect.objectContaining({command:'pause',sessionId:'live',rev:1})))
 })
 it('offers each joined participant a 1–10 rating after the meeting',async()=>{
  state.current.liveMeetings=true;const session={...live(),status:'ended' as const,joined:true,participants:[...live().participants,{userId:'a',name:'Owner A',joinedAt:2,rating:null,updatedAt:2}]};api.getLiveSessions.mockResolvedValue({sessions:[session],serverNow:Date.now()});api.liveSessionAction.mockResolvedValue(session);render(<LiveMeetings companyId="source"/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Show recaps'}));await user.click(await screen.findByRole('button',{name:'View recap'}));const ratings=within(screen.getByRole('group',{name:'Your meeting rating'}));expect(ratings.getAllByRole('button')).toHaveLength(10);await user.click(ratings.getByRole('button',{name:'9'}));await waitFor(()=>expect(api.liveSessionAction).toHaveBeenCalledWith(expect.objectContaining({command:'rate',rating:9})))
 })
 it('places the agenda in the sidebar and shows only the active populated section',async()=>{
  const slot=document.createElement('div');slot.id='live-meeting-sidebar';document.body.append(slot)
  try {
   state.current.liveMeetings=true
   const session={...live(),hostId:'a',joined:true,canControl:true}
   api.getLiveSessions.mockResolvedValue({sessions:[session],serverNow:Date.now()})
   api.liveSessionAction.mockResolvedValue({...session,activeIndex:1,rev:2})
   const review=await api.getL10();api.getL10.mockResolvedValue({...review,headlines:[{id:'headline',body:'Example team headline',ownerId:'a',authorName:'Owner A',read:false}],issues:[baseIssue]})
   render(<LiveMeetings companyId="source"/>);const user=userEvent.setup()
   await user.click(await screen.findByRole('button',{name:'Open meeting'}))
   const sidebar=within(slot);expect(sidebar.getAllByRole('button').map(button=>button.textContent?.split('0:00')[0])).toHaveLength(6)
   expect(sidebar.getByRole('complementary',{name:'Meeting agenda'})).toBeTruthy()
   const panel=within(await screen.findByRole('region',{name:'Current meeting section'}))
   expect(panel.getByRole('heading',{name:'Segue'})).toBeTruthy();expect(screen.queryByText('Example team headline')).toBeNull();expect(screen.queryByText('Zulu issue')).toBeNull()
   await user.click(screen.getByRole('button',{name:'Next section'}))
   await screen.findByText('Example team headline');expect(panel.queryByRole('heading',{name:'Segue'})).toBeNull();expect(screen.queryByText('Zulu issue')).toBeNull()
   expect(api.liveSessionAction).toHaveBeenCalledWith(expect.objectContaining({command:'select',index:1}));expect(api.getL10).toHaveBeenCalledWith('source')
   await user.click(screen.getByRole('button',{name:'All meetings'}));expect(slot.childElementCount).toBe(0)
  } finally {cleanup();slot.remove()}
 })
 it('uses stored indexes to advance older sessions in the requested order',async()=>{
  state.current.liveMeetings=true
  const legacy={...live(),joined:true,canControl:true,sections:['segue','scorecard','rocks','headlines','todos','ids','conclude'].map(id=>({id,label:id,minutes:5,spentMs:1234}))}
  api.getLiveSessions.mockResolvedValue({sessions:[legacy],serverNow:Date.now()});api.liveSessionAction.mockResolvedValue({...legacy,activeIndex:3})
  render(<LiveMeetings companyId="source"/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Open meeting'}));await user.click(screen.getByRole('button',{name:'Next section'}));await waitFor(()=>expect(api.liveSessionAction).toHaveBeenCalledWith(expect.objectContaining({command:'select',index:3})))
  expect(screen.queryByRole('button',{name:/Rock review/})).toBeNull()
 })
 it.each(['headlines','todos','scorecard','ids','conclude'])('renders only the selected %s review panel',async section=>{
  render(<L10 embedded section={section}/>);const panel=within(await screen.findByRole('region',{name:'Current meeting section'}));await waitFor(()=>expect(panel.getAllByRole('heading')).toHaveLength(1));expect(screen.queryByRole('heading',{name:'Team scorecard and review lists'})).toBeNull()
 })
 it('shows total and section time separately and calls a tangent without timer control',async()=>{
  state.current.liveMeetings=true
  const sectionTime=Date.now()-12000
  const session={...live(),joined:true,canControl:false,activeIndex:1,activeStartedAt:sectionTime,sections:defaultLiveSections().map((section,index)=>({...section,spentMs:index===0?60000:0})),tangents:[]}
  api.getLiveSessions.mockResolvedValue({sessions:[session],serverNow:Date.now()})
  api.liveSessionAction.mockResolvedValue({...session,tangents:[{id:'new-tangent',userId:'a',name:'Owner A',calledAt:Date.now()}]})
  render(<LiveMeetings companyId="source"/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Open meeting'}))
  const seconds=(label:string)=>{const [m,s]=screen.getByLabelText(label).textContent!.split(':').map(Number);return m*60+s}
  expect(seconds('Total time spent')-seconds('Section time spent')).toBe(60)
  expect(screen.queryByRole('button',{name:'Next section'})).toBeNull()
  await user.click(screen.getByRole('button',{name:'Tangent'}));await screen.findByText('Tangent called.')
  expect(api.liveSessionAction).toHaveBeenCalledWith(expect.objectContaining({command:'tangent',sessionId:'live'}))
  expect(screen.getByRole('alert').textContent).toContain('Owner A')
  await user.click(screen.getByRole('button',{name:'Dismiss tangent alert'}));expect(screen.queryByText('Tangent called.')).toBeNull()
 })
 it('alerts a joined viewer when another participant calls a tangent through shared updates',async()=>{
  vi.useFakeTimers()
  try {
   state.current.liveMeetings=true
   const session={...live(),joined:true,tangents:[]}
   api.getLiveSessions.mockResolvedValue({sessions:[session],serverNow:Date.now()})
   render(<LiveMeetings companyId="source"/>);await act(async()=>{await Promise.resolve()})
   fireEvent.click(screen.getByRole('button',{name:'Open meeting'}))
   api.getLiveSessions.mockResolvedValue({sessions:[{...session,tangents:[{id:'remote',userId:'b',name:'Owner B',calledAt:Date.now()}]}],serverNow:Date.now()})
   await act(async()=>{await vi.advanceTimersByTimeAsync(3000)})
   expect(screen.getByRole('alert').textContent).toContain('Tangent called.');expect(screen.getByRole('alert').textContent).toContain('Owner B');expect(api.liveSessionAction).not.toHaveBeenCalled()
   fireEvent.click(screen.getByRole('button',{name:'Dismiss tangent alert'}));await act(async()=>{await vi.advanceTimersByTimeAsync(3000)});expect(screen.queryByText('Tangent called.')).toBeNull()
  } finally {cleanup();vi.useRealTimers()}
 })
 it('does not replay old tangent alerts when opening a session',async()=>{
  state.current.liveMeetings=true
  api.getLiveSessions.mockResolvedValue({sessions:[{...live(),joined:true,tangents:[{id:'old',userId:'b',name:'Owner B',calledAt:1}]}],serverNow:Date.now()})
  render(<LiveMeetings companyId="source"/>);await userEvent.setup().click(await screen.findByRole('button',{name:'Open meeting'}));expect(screen.queryByText('Tangent called.')).toBeNull()
 })
 it('uses normal Issues controls and collapsed details inside the active meeting',async()=>{
  state.current.liveMeetings=true;api.getLiveSessions.mockResolvedValue({sessions:[{...live(),activeIndex:4,joined:true}],serverNow:Date.now()})
  render(<LiveMeetings companyId="source"/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Open meeting'}))
  await screen.findByRole('button',{name:'Edit issue Zulu issue'})
  const sort=within(screen.getByRole('group',{name:'Sort issues'}));expect(sort.getAllByRole('button').map(button=>button.textContent)).toEqual(['Importance','Date','Name'])
  expect(screen.getAllByText('Example issue description')[0].closest('[hidden]')).toBeTruthy()
  await user.click(screen.getAllByRole('button',{name:'Show details'})[0]);expect(screen.getAllByText('Example issue description')[0].closest('[hidden]')).toBeNull()
  await user.click(sort.getByRole('button',{name:'Name'}));expect(screen.getAllByRole('button',{name:/^Edit issue /})[0].textContent).toBe('Alpha issue')
  await user.click(sort.getByRole('button',{name:'Name'}));expect(screen.getAllByRole('button',{name:/^Edit issue /})[0].textContent).toBe('Zulu issue')
 })
 it('keeps the team review lists permanently expanded',async()=>{
  api.getL10.mockResolvedValue({agenda:defaultLiveSections().map(section=>({key:section.id,label:section.label,minutes:section.minutes})),scorecard:{rows:[],periods:[]},rocks:[],headlines:[],todos:{rows:[],completed:0,total:0,pct:null,target:.9},issues:[]});render(<L10 embedded/>);const heading=await screen.findByRole('heading',{name:'Team scorecard and review lists'});expect(heading.closest('details')).toBeNull();expect(screen.queryByText(/matching BlueStep endpoint/)).toBeNull()
 })
 it('uses Action Items with reversible Date and Name sorting',async()=>{
  api.getTodos.mockResolvedValue({rows:[{id:'one',title:'Example old action',ownerId:'b',ownerName:'Owner B',dueDate:'2026-11-10',status:'open'},{id:'two',title:'Example new action',ownerId:'a',ownerName:'Owner A',dueDate:'2026-11-12',status:'open'}]});render(<Todos/>);await screen.findByRole('button',{name:'Example old action'});expect(screen.getByRole('heading',{name:'Action Items'})).toBeTruthy();const user=userEvent.setup(),sort=within(screen.getByRole('group',{name:'Sort action items'}));await user.click(sort.getByRole('button',{name:'Date'}));expect(screen.getAllByRole('button',{name:/^Example .* action$/})[0].textContent).toBe('Example new action');await user.click(sort.getByRole('button',{name:'Name'}));expect(screen.getAllByRole('button',{name:/^Example .* action$/})[0].textContent).toBe('Example new action');await user.click(sort.getByRole('button',{name:'Name'}));expect(screen.getAllByRole('button',{name:/^Example .* action$/})[0].textContent).toBe('Example old action')
 })
})

describe('meeting lobby and type settings',()=>{
 it('disables starting another live meeting for a busy team',async()=>{
  state.current.liveMeetings=true;api.getLiveSessions.mockResolvedValue({serverNow:Date.now(),teamBusy:true,sessions:[]});render(<LiveMeetings companyId="source"/>);await screen.findByText(/already has a live meeting in progress/);expect((screen.getByRole('button',{name:'Start a meeting'}) as HTMLButtonElement).disabled).toBe(true);expect(api.liveSessionAction).not.toHaveBeenCalled()
 })
 it('keeps scheduled lists and all team review grids out of the lobby',async()=>{
  state.current.liveMeetings=true;api.getLiveSessions.mockResolvedValue({serverNow:Date.now(),sessions:[]});render(<MemoryRouter><Meetings/></MemoryRouter>);await screen.findByText(/No live meeting to display/);expect(screen.queryByText('Scheduled private meetings')).toBeNull();expect(screen.queryByText('Team scorecard and review lists')).toBeNull();expect(api.getL10).not.toHaveBeenCalled();await userEvent.setup().click(screen.getByRole('button',{name:'Scheduled meetings'}));expect(screen.getByRole('dialog',{name:'Scheduled private meetings'})).toBeTruthy()
 })
 it('renders a saved custom agenda order and sends the stored section index',async()=>{
  state.current.liveMeetings=true
  const sections=[{id:'discuss',kind:'notes',label:'Strategy discussion',minutes:20,spentMs:0,prompt:'Review priorities.'},{id:'finish',kind:'conclude',label:'Wrap up',minutes:5,spentMs:0,prompt:''}]
  const session={id:'custom',companyId:'source',meetingTypeId:'custom',title:'Custom meeting',hostId:'a',hostName:'Owner A',status:'running',activeIndex:0,activeStartedAt:Date.now(),startedAt:Date.now(),endedAt:null,sections,rev:1,participants:[],joined:true,canControl:true,serverNow:Date.now()}
  api.getLiveSessions.mockResolvedValue({serverNow:Date.now(),sessions:[session]});api.liveSessionAction.mockResolvedValue({...session,activeIndex:1});render(<LiveMeetings companyId="source"/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Open meeting'}));expect(screen.getByRole('heading',{name:'Strategy discussion',level:2})).toBeTruthy();expect(screen.getByText('Review priorities.')).toBeTruthy();expect(within(screen.getByRole('complementary',{name:'Meeting agenda'})).getAllByRole('button')).toHaveLength(2);await user.click(screen.getByRole('button',{name:'Next section'}));await waitFor(()=>expect(api.liveSessionAction).toHaveBeenCalledWith(expect.objectContaining({command:'select',index:1})))
 })
 it('edits and saves a type with a revision while leaving defaults scoped correctly',async()=>{
  render(<MeetingTypesAdmin teams={[{id:'source',name:'Source team'}]}/>);const user=userEvent.setup();await user.clear(await screen.findByLabelText('Section 1 name'));await user.type(screen.getByLabelText('Section 1 name'),'Opening check-in');await waitFor(()=>expect(api.adminSaveMeetingTypes).toHaveBeenCalledWith('source',expect.objectContaining({rev:0,types:expect.arrayContaining([expect.objectContaining({id:'l10',scope:'team',sections:expect.arrayContaining([expect.objectContaining({label:'Opening check-in'})])})])})));await user.selectOptions(screen.getByLabelText('Edit meeting type'),'one-on-one');expect((screen.getByLabelText('Visibility') as HTMLSelectElement).value).toBe('private')
 })
 it('keeps unsaved agenda changes after a failed save',async()=>{
  api.adminSaveMeetingTypes.mockRejectedValue(new Error('Agenda changed. Reload first.'));render(<MeetingTypesAdmin teams={[{id:'source',name:'Source team'}]}/>);const user=userEvent.setup();await user.clear(await screen.findByLabelText('Section 1 name'));await user.type(screen.getByLabelText('Section 1 name'),'Opening');await screen.findByText('Agenda changed. Reload first.');expect((screen.getByLabelText('Section 1 name') as HTMLInputElement).value).toBe('Opening')
 })
})

describe('Rocks agenda content',()=>{
 it('saves Rocks as a selectable agenda content kind',async()=>{
  render(<MeetingTypesAdmin teams={[{id:'source',name:'Source team'}]}/>);const user=userEvent.setup();await user.selectOptions(await screen.findByLabelText('Section 1 content'),'rocks');await waitFor(()=>expect(api.adminSaveMeetingTypes).toHaveBeenCalledWith('source',expect.objectContaining({types:expect.arrayContaining([expect.objectContaining({sections:expect.arrayContaining([expect.objectContaining({kind:'rocks'})])})])})))
 })
 it.each([undefined,'private-series'])('shows populated Rocks for the explicit meeting team (private=%s)',async meetingId=>{
  state.current.liveMeetings=true
  const review=await api.getL10();api.getL10.mockClear();api.getL10.mockResolvedValue({...review,rocks:[rock]})
  const sections=[{id:'rock-review',kind:'rocks',label:'Quarterly Rocks',minutes:5,spentMs:0},{id:'finish',kind:'conclude',label:'Conclusion',minutes:5,spentMs:0}]
  const session={id:'rocks-session',companyId:'meeting-team',meetingId:meetingId || '',date:'2026-11-12',meetingTypeId:'custom',title:'Example meeting',hostId:'a',hostName:'Owner A',status:'running',activeIndex:0,activeStartedAt:Date.now(),startedAt:Date.now(),endedAt:null,sections,rev:1,participants:[],joined:true,canControl:true,serverNow:Date.now()}
  api.getLiveSessions.mockResolvedValue({serverNow:Date.now(),sessions:[session]});render(<LiveMeetings companyId="meeting-team" meetingId={meetingId} date={meetingId?'2026-11-12':undefined}/>);await userEvent.setup().click(await screen.findByRole('button',{name:'Open meeting'}));await screen.findByText('Example Rock');expect(screen.getByRole('heading',{name:'Quarterly Rocks',level:2})).toBeTruthy();expect(api.getL10).toHaveBeenCalledWith('meeting-team');expect(screen.queryByText('Example issue description')).toBeNull()
 })
})

describe('agenda autosave structure',()=>{
 it('automatically saves content changes and keeps a final Conclusion when replacing it with Rocks',async()=>{
  render(<MeetingTypesAdmin teams={[{id:'source',name:'Source team'}]}/>);const user=userEvent.setup();await user.selectOptions(await screen.findByLabelText('Section 6 content'),'rocks');expect(screen.queryByRole('button',{name:'Save meeting types'})).toBeNull();await waitFor(()=>expect(api.adminSaveMeetingTypes).toHaveBeenCalled());const sections=api.adminSaveMeetingTypes.mock.calls[api.adminSaveMeetingTypes.mock.calls.length-1][1].types[0].sections;expect(sections[5].kind).toBe('rocks');expect(sections).toHaveLength(7);expect(sections[6].kind).toBe('conclude');expect(sections.filter((section:any)=>section.kind==='conclude')).toHaveLength(1)
 })
 it('automatically saves section order while preventing Conclusion from leaving the end',async()=>{
  render(<MeetingTypesAdmin teams={[{id:'source',name:'Source team'}]}/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Move section 1 down'}));await waitFor(()=>expect(api.adminSaveMeetingTypes).toHaveBeenCalled());expect(api.adminSaveMeetingTypes.mock.calls[api.adminSaveMeetingTypes.mock.calls.length-1][1].types[0].sections[0].kind).toBe('headlines');expect((screen.getByRole('button',{name:'Move section 6 up'}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole('button',{name:'Move section 5 down'}) as HTMLButtonElement).disabled).toBe(true)
 })
})

describe('track record and typed meeting scheduling',()=>{
 it('keeps all-time rates visible when changing list filters',async()=>{
  api.getTodos.mockResolvedValue({rows:[],trackRecord:{asOf:'2026-11-12',rows:[{id:'a',name:'Owner A',onTime:3,scored:4,unscored:1,rate:.75},{id:'b',name:'Owner B',onTime:0,scored:0,unscored:2,rate:null}]}});render(<Todos/>);await screen.findByText('75%');const strip=screen.getByLabelText('All-time action item on-time rates');expect(strip.textContent).toContain('—');await userEvent.setup().click(screen.getByRole('button',{name:'Mine'}));await waitFor(()=>expect(api.getTodos).toHaveBeenCalledWith('source',true,'open'));expect(within(strip).getByText('75%')).toBeTruthy()
 })
 it('populates the team roster and derives the title from the selected type',async()=>{
  state.current.teams={source:people,second:[{id:'c',name:'Member C'}]};render(<MeetingForm onDone={()=>{}}/>);await waitFor(()=>expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('L10'));expect((screen.getByLabelText('Title') as HTMLInputElement).readOnly).toBe(true);expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('L10');expect(screen.getAllByRole('checkbox').every(input=>(input as HTMLInputElement).checked)).toBe(true)
  const user=userEvent.setup();await user.selectOptions(screen.getByLabelText('Scheduled meeting type'),'one-on-one');expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('One-on-one');await user.click(screen.getByRole('button',{name:'Create meeting'}));await waitFor(()=>expect(api.saveMeeting).toHaveBeenCalledWith(expect.objectContaining({companyId:'source',meetingTypeId:'one-on-one',title:'One-on-one',attendeeIds:['a','b']})))
 })
 it('clears the previous team attendees when a different team is selected',async()=>{
  state.current.teams={source:people,second:[{id:'c',name:'Member C'}]};api.getMeetingTypes.mockImplementation(async(teamId)=>({rev:0,types:defaultMeetingTypes().map(type=>({...type,name:type.id==='l10'&&teamId==='second'?'Second team review':type.name}))}));render(<MeetingForm onDone={()=>{}}/>);await waitFor(()=>expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('L10'));const user=userEvent.setup();await user.selectOptions(screen.getByLabelText('Meeting team'),'second');await waitFor(()=>expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Second team review'));expect(screen.queryByText('Owner A')).toBeNull();expect(screen.getAllByRole('checkbox')).toHaveLength(1);expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);await user.click(screen.getByRole('button',{name:'Create meeting'}));await waitFor(()=>expect(api.saveMeeting).toHaveBeenCalledWith(expect.objectContaining({companyId:'second',title:'Second team review',attendeeIds:['c']})))
 })
 it('groups dashboard counts and shows milestone progress with clear labels',async()=>{
  api.getMy90.mockResolvedValue({todos:[{id:'old',status:'open',dueDate:'1900-01-01',title:'Old',ownerId:'a',ownerName:'Owner A'},{id:'future',status:'open',dueDate:'2099-01-01',title:'Future',ownerId:'a',ownerName:'Owner A'}],rocks:[{...rock,milestones:[{id:'late',done:false,dueDate:'1900-01-01'},{id:'done',done:true,dueDate:'1900-01-01'}]}],milestones:[],measurables:[measurable]});render(<MemoryRouter><My90/></MemoryRouter>);const actions=await screen.findByRole('region',{name:'Action item summary'});expect(actions.textContent).toContain('2 open');expect(actions.textContent).toContain('1 of these are overdue');const rocks=screen.getByRole('region',{name:'Rock summary'});expect(rocks.textContent).toContain('1 of 2 milestones complete');expect(rocks.textContent).toContain('1 overdue');expect(screen.getAllByRole('heading',{name:'My Scorecard Numbers'})).toHaveLength(2);expect(screen.queryByText('Latest red')).toBeNull()
 })
 it('uses initials before each measurable title without a visible full name',async()=>{
  const view=render(<Scorecard/>);const title=await screen.findByRole('button',{name:'Example measurable'});const row=title.closest('th')!;expect(row.querySelector('.meas__title')?.firstElementChild?.classList.contains('avatar')).toBe(true);expect(view.container.querySelector('.owner__name')).toBeNull();expect(row.querySelector('[aria-label="Owner A"]')).toBeTruthy()
 })
})
