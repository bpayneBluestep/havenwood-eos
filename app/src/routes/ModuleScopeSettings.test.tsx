// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from 'vitest'
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react'
import ModuleScopeSettings from './ModuleScopeSettings'
import {getModuleScopes,saveModuleScope} from '../api'
vi.mock('../api',()=>({getModuleScopes:vi.fn(),saveModuleScope:vi.fn()}))
afterEach(()=>{cleanup();vi.resetAllMocks()})
const reply={companies:[{id:'c1',name:'Company A'}],teams:[{id:'t1',companyId:'c1',name:'Team A'},{id:'t2',companyId:'c2',name:'Team B'}],scope:null}
describe('module scope settings',()=>{
 it('uses a separate company choice and only its actual teams',async()=>{vi.mocked(getModuleScopes).mockResolvedValue(reply);render(<ModuleScopeSettings/>);await screen.findByRole('option',{name:'Company A'});fireEvent.change(screen.getByRole('combobox',{name:'Company'}),{target:{value:'c1'}});await screen.findAllByRole('checkbox');expect(screen.queryByText('Team B')).toBeNull();expect(screen.getAllByText('Team A')).toHaveLength(2);expect(screen.getAllByText('No teams selected. Content is restricted.')).toHaveLength(2)})
 it('saves explicit scope choices and the expected revision',async()=>{vi.mocked(getModuleScopes).mockResolvedValue(reply);vi.mocked(saveModuleScope).mockResolvedValue({rev:1} as never);render(<ModuleScopeSettings/>);await screen.findByRole('option',{name:'Company A'});fireEvent.change(screen.getByRole('combobox'),{target:{value:'c1'}});const boxes=await screen.findAllByRole('checkbox');fireEvent.click(boxes[0]);fireEvent.click(screen.getByRole('button',{name:'Save visibility'}));await waitFor(()=>expect(saveModuleScope).toHaveBeenCalledWith('c1',{vision:['t1'],accountability:[]},0));await screen.findByText('Visibility saved.')})
 it('keeps unsaved choices on a stale save',async()=>{vi.mocked(getModuleScopes).mockResolvedValue(reply);vi.mocked(saveModuleScope).mockRejectedValue(Error('Reload before saving. This record changed.'));render(<ModuleScopeSettings/>);await screen.findByRole('option',{name:'Company A'});fireEvent.change(screen.getByRole('combobox'),{target:{value:'c1'}});const boxes=await screen.findAllByRole('checkbox');fireEvent.click(boxes[0]);fireEvent.click(screen.getByRole('button',{name:'Save visibility'}));await screen.findByText('Reload before saving. This record changed.');expect((boxes[0] as HTMLInputElement).checked).toBe(true)})
})
