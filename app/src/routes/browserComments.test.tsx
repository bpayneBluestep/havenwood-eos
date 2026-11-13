// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {cleanup,render,screen,within,waitFor,fireEvent} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type {Issue,Rock,Measurable} from '../api'
const api=vi.hoisted(()=>({getIssues:vi.fn(),saveIssue:vi.fn(),getRocks:vi.fn(),getRocksBoard:vi.fn(),saveScorecardSections:vi.fn(),getScorecard:vi.fn(),saveMeasurable:vi.fn(),setScore:vi.fn(),getLiveSessions:vi.fn(),liveSessionAction:vi.fn(),getTodos:vi.fn(),getL10:vi.fn()}))
const state=vi.hoisted(()=>({current:{} as any}))
vi.mock('../api',async()=>({...await vi.importActual('../api'),...api}))
vi.mock('../state',()=>({useApp:()=>state.current}))
import LiveMeetings from '../meetings/LiveMeetings'
import Todos from './Todos'
import L10 from './L10'
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
  state.current.liveMeetings=true;const session={...live(),status:'ended' as const,joined:true,participants:[...live().participants,{userId:'a',name:'Owner A',joinedAt:2,rating:null,updatedAt:2}]};api.getLiveSessions.mockResolvedValue({sessions:[session],serverNow:Date.now()});api.liveSessionAction.mockResolvedValue(session);render(<LiveMeetings companyId="source"/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'View recap'}));const ratings=within(screen.getByRole('group',{name:'Your meeting rating'}));expect(ratings.getAllByRole('button')).toHaveLength(10);await user.click(ratings.getByRole('button',{name:'9'}));await waitFor(()=>expect(api.liveSessionAction).toHaveBeenCalledWith(expect.objectContaining({command:'rate',rating:9})))
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
 it('keeps the team review lists permanently expanded',async()=>{
  api.getL10.mockResolvedValue({agenda:defaultLiveSections().map(section=>({key:section.id,label:section.label,minutes:section.minutes})),scorecard:{rows:[],periods:[]},rocks:[],headlines:[],todos:{rows:[],completed:0,total:0,pct:null,target:.9},issues:[]});render(<L10 embedded/>);const heading=await screen.findByRole('heading',{name:'Team scorecard and review lists'});expect(heading.closest('details')).toBeNull();expect(screen.queryByText(/matching BlueStep endpoint/)).toBeNull()
 })
 it('uses Action Items with reversible Date and Name sorting',async()=>{
  api.getTodos.mockResolvedValue({rows:[{id:'one',title:'Example old action',ownerId:'b',ownerName:'Owner B',dueDate:'2026-11-10',status:'open'},{id:'two',title:'Example new action',ownerId:'a',ownerName:'Owner A',dueDate:'2026-11-12',status:'open'}]});render(<Todos/>);await screen.findByRole('button',{name:'Example old action'});expect(screen.getByRole('heading',{name:'Action Items'})).toBeTruthy();const user=userEvent.setup(),sort=within(screen.getByRole('group',{name:'Sort action items'}));await user.click(sort.getByRole('button',{name:'Date'}));expect(screen.getAllByRole('button',{name:/^Example .* action$/})[0].textContent).toBe('Example new action');await user.click(sort.getByRole('button',{name:'Name'}));expect(screen.getAllByRole('button',{name:/^Example .* action$/})[0].textContent).toBe('Example new action');await user.click(sort.getByRole('button',{name:'Name'}));expect(screen.getAllByRole('button',{name:/^Example .* action$/})[0].textContent).toBe('Example old action')
 })
})
