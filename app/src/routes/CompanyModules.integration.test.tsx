// @vitest-environment jsdom
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
import {act,cleanup,render,screen,fireEvent,waitFor,within} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import {emptyCompanyPlan,companyPlanId} from '../../../platform/companyPlan'
import {BHAG} from '../lib/brand'
const state=vi.hoisted(()=>({current:{} as any}))
const api=vi.hoisted(()=>({getModuleContext:vi.fn(),listModuleRecords:vi.fn(),saveModuleRecord:vi.fn(),saveAccountabilitySeat:vi.fn(),getRocks:vi.fn(),getIssues:vi.fn(),getScorecard:vi.fn(),resolveModuleLink:vi.fn()}))
vi.mock('../state',()=>({useApp:()=>state.current}))
vi.mock('../api',async()=>({...await vi.importActual('../api'),...api}))
vi.mock('../modules/AccountabilityChart',()=>({default:({seats,onOpen,onMove}:{seats:{id:string;data:{title:string}}[];onOpen:(seat:unknown)=>void;onMove:(id:string,parent:string)=>void})=><div aria-label="Test chart">{seats.map(seat=><button key={seat.id} onClick={()=>onOpen(seat)}>{`Open chart seat ${seat.data.title}`}</button>)}<button onClick={()=>onMove('s1','s2')}>Move test seat to parent</button></div>}))
import Vision from './Vision'
import Accountability from './Accountability'
const context={companies:[{id:'c1',name:'Company A'}],companyName:'Company A',teams:[{id:'t1',name:'Team A'}],people:[{id:'p1',name:'Person A'}],allowed:true,canEdit:true}
const baseEntity={schemaVersion:1,companyId:'c1',rev:4,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',editorId:'p1',archived:false}
const seatData={title:'Seat A',teamId:'t1',parentSeatId:'',state:'filled',mission:'Purpose',responsibilities:['Own outcome'],mco:'Result',drivers:[],obsessions:[],sections:[],interimPersonId:'',targetDate:'',links:[],sourceText:'',displayOrder:0}
const seats=[{...baseEntity,id:'s1',kind:'tenk_seat',data:seatData},{...baseEntity,id:'s2',kind:'tenk_seat',data:{...seatData,title:'Parent seat',state:'vacant'}}]
const assignments=[{...baseEntity,id:'a1',kind:'tenk_assignment',data:{seatId:'s1',personId:'p1',startDate:'2020-01-01',endDate:null}}]
const mount=(node:React.ReactNode)=>render(<MemoryRouter>{node}</MemoryRouter>)
beforeEach(()=>{
 vi.clearAllMocks();state.current={company:{id:'t1',homeId:'c1',name:'Team A'},companies:[{id:'t1',homeId:'c1',name:'Team A'}],me:{id:'p1',name:'Person A',isAdmin:true}};
 vi.mocked(api.getModuleContext).mockResolvedValue(context);
 vi.mocked(api.listModuleRecords).mockResolvedValue({records:[]});
 vi.mocked(api.getRocks).mockResolvedValue({rows:[]});vi.mocked(api.getIssues).mockResolvedValue({rows:[]});vi.mocked(api.getScorecard).mockResolvedValue({rows:[]});
 vi.mocked(api.resolveModuleLink).mockRejectedValue(Error('Not available'));
 vi.mocked(api.saveModuleRecord).mockResolvedValue({...baseEntity,id:'saved'});vi.mocked(api.saveAccountabilitySeat).mockResolvedValue({...baseEntity,id:'saved'});
})
afterEach(cleanup)
describe('company module access and plan editing',()=>{
 it.each([['Vision',<Vision/>],['Accountability',<Accountability/>]])('does not read domain data or offer writes when %s access is denied',async(_name,node)=>{
  api.getModuleContext.mockResolvedValue({...context,allowed:false,canEdit:false,teams:[],people:[]});mount(node);
  await screen.findByRole('heading',{name:'Access is restricted'});
  expect(api.listModuleRecords).not.toHaveBeenCalled();expect(api.getRocks).not.toHaveBeenCalled();expect(api.getIssues).not.toHaveBeenCalled();expect(api.saveModuleRecord).not.toHaveBeenCalled();expect(api.saveAccountabilitySeat).not.toHaveBeenCalled();
  expect(screen.queryByRole('button',{name:'Create plan'})).toBeNull();expect(screen.queryByRole('button',{name:'+ Seat'})).toBeNull();
 });
 it('creates a plan with empty business content and uses the BHAG only after explicit selection',async()=>{
  api.saveModuleRecord.mockRejectedValueOnce(Error('Save failed. Keep your changes.')).mockResolvedValueOnce({...baseEntity,id:companyPlanId('c1')});mount(<Vision/>);
  await screen.findByText(/No company plan has been added/);fireEvent.click(screen.getByRole('button',{name:'Create plan'}));
  const dialog=screen.getByRole('dialog',{name:'Create company plan'});
  expect((within(dialog).getByLabelText('Mission') as HTMLTextAreaElement).value).toBe('');expect((within(dialog).getByLabelText('BHAG') as HTMLTextAreaElement).value).toBe('');
  fireEvent.change(within(dialog).getByLabelText('Mission'),{target:{value:'A deliberate company mission'}});fireEvent.click(within(dialog).getByRole('button',{name:'Use TenK BHAG'}));
  expect((within(dialog).getByLabelText('BHAG') as HTMLTextAreaElement).value).toBe(BHAG);
  fireEvent.click(within(dialog).getByRole('button',{name:'Save plan'}));await screen.findByText('Save failed. Keep your changes.');expect((within(dialog).getByLabelText('Mission') as HTMLTextAreaElement).value).toBe('A deliberate company mission');
  fireEvent.click(within(dialog).getByRole('button',{name:'Save plan'}));await waitFor(()=>expect(api.saveModuleRecord).toHaveBeenLastCalledWith(expect.objectContaining({scopeCompanyId:'c1',id:companyPlanId('c1'),kind:'tenk_plan',rev:0,data:expect.objectContaining({mission:'A deliberate company mission',bhag:BHAG,targets:[],values:[]})})));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 });
 it('saves an existing plan with its revision and cancels a second edit without writing',async()=>{
  const plan={...baseEntity,id:companyPlanId('c1'),kind:'tenk_plan',rev:7,data:{...emptyCompanyPlan(new Date().getFullYear()),title:'Company direction',mission:'Original mission'}};
  api.listModuleRecords.mockImplementation(async(_id,kind)=>({records:kind==='tenk_plan'?[plan]:[]}));mount(<Vision/>);await screen.findByText('Original mission');fireEvent.click(screen.getByRole('button',{name:'Edit plan'}));fireEvent.change(screen.getByLabelText('Mission'),{target:{value:'Updated mission'}});fireEvent.click(screen.getByRole('button',{name:'Save plan'}));await waitFor(()=>expect(api.saveModuleRecord).toHaveBeenCalledWith(expect.objectContaining({id:plan.id,rev:7,data:expect.objectContaining({mission:'Updated mission'})})));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());fireEvent.click(screen.getByRole('button',{name:'Edit plan'}));fireEvent.change(screen.getByLabelText('Mission'),{target:{value:'Unsaved edit'}});fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(api.saveModuleRecord).toHaveBeenCalledTimes(1);
 });
 it('keeps meeting plan review read-only even when the viewer can edit the standalone plan',async()=>{
  mount(<Vision embedded companyId="c1"/>);await screen.findByRole('heading',{name:'3-Year Plan'});expect(screen.queryByRole('button',{name:'Create plan'})).toBeNull();expect(screen.queryByRole('button',{name:'+ Priority'})).toBeNull();expect(screen.queryByRole('button',{name:'Tools'})).toBeNull();expect(api.saveModuleRecord).not.toHaveBeenCalled();expect(api.getIssues).not.toHaveBeenCalled();
 });
})
describe('accountability seat editing',()=>{
 it('requires an occupant for a filled seat and keeps failed edits available',async()=>{
  api.saveAccountabilitySeat.mockRejectedValue(Error('Reload before saving. This record changed.'));mount(<Accountability/>);await screen.findByText('No seats yet');fireEvent.click(screen.getByRole('button',{name:'+ Seat'}));const dialog=screen.getByRole('dialog',{name:'New seat'});fireEvent.change(within(dialog).getByLabelText('Seat title'),{target:{value:'Operations seat'}});fireEvent.change(within(dialog).getByLabelText('Seat state'),{target:{value:'filled'}});expect((within(dialog).getByRole('button',{name:'Save seat'}) as HTMLButtonElement).disabled).toBe(true);fireEvent.change(within(dialog).getByLabelText('Accountable person'),{target:{value:'p1'}});fireEvent.click(within(dialog).getByRole('button',{name:'Save seat'}));await screen.findByText('Reload before saving. This record changed.');expect((within(dialog).getByLabelText('Seat title') as HTMLInputElement).value).toBe('Operations seat');expect(api.saveAccountabilitySeat).toHaveBeenCalledWith(expect.objectContaining({scopeCompanyId:'c1',rev:0,occupantId:'p1',data:expect.objectContaining({state:'filled',title:'Operations seat'})}));
 });
 it('moves an existing seat through its editor with the original revision and occupant',async()=>{
  api.listModuleRecords.mockImplementation(async(_id,kind)=>({records:kind==='tenk_seat'?seats:kind==='tenk_assignment'?assignments:[]}));mount(<Accountability/>);fireEvent.click(await screen.findByRole('button',{name:'Open chart seat Seat A'}));fireEvent.click(screen.getByRole('button',{name:'Edit / Move seat'}));const dialog=screen.getByRole('dialog',{name:'Edit seat'});fireEvent.change(within(dialog).getByLabelText('Reports to'),{target:{value:'s2'}});fireEvent.click(within(dialog).getByRole('button',{name:'Save seat'}));await waitFor(()=>expect(api.saveAccountabilitySeat).toHaveBeenCalledWith(expect.objectContaining({scopeCompanyId:'c1',id:'s1',rev:4,occupantId:'p1',data:expect.objectContaining({parentSeatId:'s2'})})));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 });
 it('uses the same revision-checked save path for a chart move',async()=>{
  api.listModuleRecords.mockImplementation(async(_id,kind)=>({records:kind==='tenk_seat'?seats:kind==='tenk_assignment'?assignments:[]}));mount(<Accountability/>);fireEvent.click(await screen.findByRole('button',{name:'Move test seat to parent'}));await waitFor(()=>expect(api.saveAccountabilitySeat).toHaveBeenCalledWith(expect.objectContaining({scopeCompanyId:'c1',id:'s1',rev:4,occupantId:'p1',data:expect.objectContaining({parentSeatId:'s2'})})));expect(api.saveModuleRecord).not.toHaveBeenCalled();
 });
})


describe('company scope request ordering',()=>{
 it('ignores delayed plan content from the previous company after a company switch',async()=>{
  let resolveOld:(value:any)=>void=()=>{};
  const oldPlan=new Promise(resolve=>{resolveOld=resolve});
  const companies=[{id:'c1',name:'Company A'},{id:'c2',name:'Company B'}];
  api.getModuleContext.mockImplementation(async(_module,id)=>({...context,companies,companyName:id==='c2'?'Company B':'Company A',teams:[]}));
  const planFor=(id:string,title:string)=>({...baseEntity,id:companyPlanId(id),companyId:id,kind:'tenk_plan',data:{...emptyCompanyPlan(new Date().getFullYear()),title,mission:title+' mission'}});
  api.listModuleRecords.mockImplementation((id,kind)=>id==='c1'&&kind==='tenk_plan'?oldPlan:Promise.resolve({records:id==='c2'&&kind==='tenk_plan'?[planFor('c2','New company direction')]:[]}));
  mount(<Vision/>);await waitFor(()=>expect(api.listModuleRecords).toHaveBeenCalledWith('c1','tenk_plan',false));
  fireEvent.change(screen.getByRole('combobox',{name:'Company'}),{target:{value:'c2'}});
  await screen.findByRole('heading',{name:'New company direction'});
  await act(async()=>{resolveOld({records:[planFor('c1','Old company direction')]});await oldPlan});
  expect(screen.getByRole('heading',{name:'New company direction'})).toBeTruthy();expect(screen.queryByText('Old company direction')).toBeNull();expect(screen.queryByText('Old company direction mission')).toBeNull();
  expect(api.saveModuleRecord).not.toHaveBeenCalled();
 });
 it('ignores delayed seats and assignments from the previous company after a company switch',async()=>{
  let resolveOld:(value:any)=>void=()=>{};
  const oldSeats=new Promise(resolve=>{resolveOld=resolve});
  const companies=[{id:'c1',name:'Company A'},{id:'c2',name:'Company B'}];
  api.getModuleContext.mockImplementation(async(_module,id)=>({...context,companies,companyName:id==='c2'?'Company B':'Company A',teams:[]}));
  const nextSeat={...baseEntity,id:'s3',companyId:'c2',kind:'tenk_seat',data:{...seatData,title:'New company seat',state:'vacant'}};
  api.listModuleRecords.mockImplementation((id,kind)=>id==='c1'&&kind==='tenk_seat'?oldSeats:Promise.resolve({records:id==='c2'&&kind==='tenk_seat'?[nextSeat]:id==='c1'&&kind==='tenk_assignment'?assignments:[]}));
  mount(<Accountability/>);await waitFor(()=>expect(api.listModuleRecords).toHaveBeenCalledWith('c1','tenk_seat',false));
  fireEvent.change(screen.getByRole('combobox',{name:'Company'}),{target:{value:'c2'}});
  await screen.findByRole('button',{name:'Open chart seat New company seat'});
  await act(async()=>{resolveOld({records:seats});await oldSeats});
  expect(screen.getByRole('button',{name:'Open chart seat New company seat'})).toBeTruthy();expect(screen.queryByRole('button',{name:'Open chart seat Seat A'})).toBeNull();
  expect(api.saveAccountabilitySeat).not.toHaveBeenCalled();
 });
});

it('shows three-year and one-year segments together and aligns quarterly Rocks in four columns',async()=>{
 const plan={...baseEntity,id:companyPlanId('c1'),kind:'tenk_plan',data:{...emptyCompanyPlan(2026),mission:'Company mission',threeYearVision:'Three-year destination text'}};
 api.getModuleContext.mockResolvedValue({...context,currentQuarter:'2026-Q4'});
 api.listModuleRecords.mockImplementation(async(_id,kind)=>({records:kind==='tenk_plan'?[plan]:[]}));
 api.getRocks.mockResolvedValue({rows:[{id:'r1',title:'Quarterly delivery goal',ownerId:'p1',ownerName:'Person A',dueDate:'2026-12-15',status:'off_track',quarterKey:'2026-Q4',milestones:[]}]});
 mount(<Vision/>);
 await screen.findByText('Three-year destination text');
 expect(screen.getByRole('heading',{name:'3-Year Plan'})).toBeTruthy();expect(screen.getByRole('heading',{name:'1-Year Plan · 2026'})).toBeTruthy();
 expect(screen.queryByLabelText('Plan year filter')).toBeNull();
 const table=within(screen.getByRole('region',{name:'Quarterly Rocks'})).getByRole('table');
 expect(within(table).getAllByRole('columnheader').map(cell=>cell.textContent)).toEqual(['Name','Date','Status','Title']);
 const cells=within(within(table).getAllByRole('row')[1]).getAllByRole('cell');
 expect(cells[0].textContent).toContain('Person A');expect(cells[1].textContent).toBe('Dec 15');expect(cells[2].textContent).toContain('Off Track');expect(within(cells[3]).getByRole('link',{name:'Quarterly delivery goal'})).toBeTruthy();
 expect(document.querySelectorAll('.vision-ribbon').length).toBe(4);
 expect(api.saveModuleRecord).not.toHaveBeenCalled();
});
