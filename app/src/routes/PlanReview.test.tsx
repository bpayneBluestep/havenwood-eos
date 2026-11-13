// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest'
import {cleanup,render,screen} from '@testing-library/react'
const state=vi.hoisted(()=>({current:{} as any}))
const api=vi.hoisted(()=>({getL10:vi.fn(),liveSessionAction:vi.fn()}))
vi.mock('../state',()=>({useApp:()=>state.current}))
vi.mock('../api',async()=>({...await vi.importActual('../api'),...api}))
vi.mock('./Vision',()=>({default:({embedded,companyId}:{embedded?:boolean;companyId?:string})=><div data-testid="plan-review" data-embedded={String(embedded)} data-company={companyId}>Read-only plan review</div>}))
import L10 from './L10'
beforeEach(()=>{vi.clearAllMocks();state.current={company:{id:'team-a',homeId:'company-a',name:'Team A'},companies:[{id:'team-a',homeId:'company-a'},{id:'team-b',homeId:'company-b'}],nameOf:()=>''}})
afterEach(cleanup)
it('uses the saved meeting team home company and does not fetch unrelated meeting lists',()=>{
 render(<L10 embedded section="vision" sectionLabel="Strategy review" sectionNumber={3} companyId="team-b"/>);
 expect(screen.getByRole('heading',{name:'Strategy review'})).toBeTruthy();
 expect(screen.getByTestId('plan-review').getAttribute('data-company')).toBe('company-b');
 expect(screen.getByTestId('plan-review').getAttribute('data-embedded')).toBe('true');
 expect(api.getL10).not.toHaveBeenCalled();expect(api.liveSessionAction).not.toHaveBeenCalled();
});
it('uses a company team identity directly and retains the requested agenda section on rerender',()=>{
 state.current={...state.current,company:{id:'company-a',name:'Company A'},companies:[{id:'company-a',name:'Company A'}]};
 const view=render(<L10 embedded section="vision" sectionNumber={2}/>);
 expect(screen.getByTestId('plan-review').getAttribute('data-company')).toBe('company-a');
 view.rerender(<L10 embedded section="vision" sectionNumber={2} sectionLabel="Direction"/>);
 expect(screen.getByRole('heading',{name:'Direction'})).toBeTruthy();
 expect(screen.queryByText('Issues still open')).toBeNull();expect(api.liveSessionAction).not.toHaveBeenCalled();
});
