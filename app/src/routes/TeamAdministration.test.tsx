// @vitest-environment jsdom
import {render,screen,waitFor,cleanup} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
const mocks=vi.hoisted(()=>({adminOverview:vi.fn(),adminTeam:vi.fn(),adminPeople:vi.fn(),adminSetMembership:vi.fn(),adminSetTeamAdmin:vi.fn(),adminSaveTeam:vi.fn(),me:{isAdmin:true,isTeamAdmin:false}}))
vi.mock('../state',()=>({useApp:()=>({me:mocks.me})}))
vi.mock('../api',async()=>({...await vi.importActual('../api'),...mocks}))
import Admin from './Admin'
const team={id:'team',kind:'company',name:'Example team',homeId:'entity',homeName:'Example entity',memberCount:1,archivedAt:null,eosActive:true,rev:3,settingsRev:0,adminIds:[],settings:{}}
beforeEach(()=>{vi.clearAllMocks();mocks.me.isAdmin=true;mocks.adminOverview.mockResolvedValue({teams:[team],companies:[],admins:[],reach:'unit'});mocks.adminTeam.mockResolvedValue({team,members:[{id:'person',name:'Example Member',email:'',former:false}]});mocks.adminPeople.mockResolvedValue({rows:[]});mocks.adminSaveTeam.mockResolvedValue({team:{...team,archivedAt:'2026-11-18',rev:4}});mocks.adminSetTeamAdmin.mockResolvedValue({team:{...team,rev:4,adminIds:['person']}})})
afterEach(()=>{cleanup();vi.restoreAllMocks()})
it('lets system admins assign team administration using the team revision',async()=>{render(<Admin/>);const checkbox=await screen.findByRole('checkbox',{name:'Team admin: Example Member'});await userEvent.setup().click(checkbox);await waitFor(()=>expect(mocks.adminSetTeamAdmin).toHaveBeenCalledWith('team','person',true,3));expect((checkbox as HTMLInputElement).checked).toBe(true)})
it('limits delegated admins to their team membership controls',async()=>{mocks.me.isAdmin=false;mocks.me.isTeamAdmin=true;render(<Admin/>);await screen.findByText('Example Member');expect(screen.queryByRole('checkbox',{name:/Team admin:/})).toBeNull();expect(screen.queryByRole('button',{name:'Remove'})).toBeNull();expect(screen.queryByRole('button',{name:'+ New team'})).toBeNull();expect(screen.queryByRole('button',{name:'Settings'})).toBeNull();await userEvent.setup().type(screen.getByRole('textbox',{name:'Search staff to add'}),'Example');await waitFor(()=>expect(mocks.adminPeople).toHaveBeenCalledWith('Example','team'))})

it('lets a system admin remove a company team from its row menu after confirmation',async()=>{
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(true);render(<Admin/>);const user=userEvent.setup()
 await user.click(await screen.findByRole('button',{name:'Actions for Example team'}))
 await user.click(screen.getByRole('menuitem',{name:'Delete team'}))
 expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Its data stays intact'))
 await waitFor(()=>expect(mocks.adminSaveTeam).toHaveBeenCalledWith({companyId:'team',archived:true,rev:3}))
 await screen.findByRole('button',{name:'Show archived (1)'})
})
it('does not send a delete request when confirmation is cancelled',async()=>{
 vi.spyOn(window,'confirm').mockReturnValue(false);render(<Admin/>);const user=userEvent.setup()
 await user.click(await screen.findByRole('button',{name:'Actions for Example team'}));await user.click(screen.getByRole('menuitem',{name:'Delete team'}))
 expect(mocks.adminSaveTeam).not.toHaveBeenCalled()
})
it('does not show team action menus to delegated team admins',async()=>{
 mocks.me.isAdmin=false;mocks.me.isTeamAdmin=true;render(<Admin/>);await screen.findByText('Example Member')
 expect(screen.queryByRole('button',{name:'Actions for Example team'})).toBeNull();expect(screen.queryByRole('button',{name:'Delete team'})).toBeNull()
})
