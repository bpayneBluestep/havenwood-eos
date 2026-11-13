// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest'
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react'
import PlanAccess from './PlanAccess'
import {getModuleScopes,saveModuleScope} from '../api'
vi.mock('../api',()=>({getModuleScopes:vi.fn(),saveModuleScope:vi.fn()}))
afterEach(()=>{cleanup();vi.resetAllMocks()})
const scope={id:'visibility_c1',companyId:'c1',rev:7,data:{vision:['t1'],accountability:['chartTeam']}}
const reply={companies:[],teams:[{id:'t1',name:'Team A',companyId:'c1'},{id:'t2',name:'Team B',companyId:'c1'},{id:'foreign',name:'Other company',companyId:'c2'}],scope}
it('saves only explicit plan access changes and retains chart access and revision',async()=>{
 vi.mocked(getModuleScopes).mockResolvedValue(reply as never);vi.mocked(saveModuleScope).mockResolvedValue({...scope,rev:8,data:{vision:['t1','t2'],accountability:['chartTeam']}} as never);const onSaved=vi.fn();render(<PlanAccess companyId="c1" onSaved={onSaved}/>);
 await screen.findByRole('checkbox',{name:'Team A'});expect(screen.queryByText('Other company')).toBeNull();fireEvent.click(screen.getByRole('checkbox',{name:'Team B'}));expect(saveModuleScope).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Save plan access'}));await waitFor(()=>expect(saveModuleScope).toHaveBeenCalledWith('c1',{vision:['t1','t2'],accountability:['chartTeam']},7));expect(onSaved).toHaveBeenCalledTimes(1);
});
it('keeps selected teams after a rejected stale save',async()=>{
 vi.mocked(getModuleScopes).mockResolvedValue(reply as never);vi.mocked(saveModuleScope).mockRejectedValue(Error('Reload before saving.'));render(<PlanAccess companyId="c1" onSaved={vi.fn()}/>);await screen.findByRole('checkbox',{name:'Team B'});fireEvent.click(screen.getByRole('checkbox',{name:'Team B'}));fireEvent.click(screen.getByRole('button',{name:'Save plan access'}));await screen.findByText('Reload before saving.');expect((screen.getByRole('checkbox',{name:'Team B'}) as HTMLInputElement).checked).toBe(true);
});
