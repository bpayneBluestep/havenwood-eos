// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest'
import {render,screen,cleanup} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
const mocks=vi.hoisted(()=>({directory:vi.fn(),nav:vi.fn(),setTeam:vi.fn()}))
vi.mock('../api',()=>({getLiveMeetingDirectory:mocks.directory}))
vi.mock('../state',()=>({useApp:()=>({liveMeetings:true,companies:[],setCompanyId:mocks.setTeam})}))
vi.mock('react-router-dom',()=>({useNavigate:()=>mocks.nav}))
import LiveMeetingLink from './LiveMeetingLink'
beforeEach(()=>vi.clearAllMocks())
afterEach(cleanup)
it('shows only the authorized directory entries and preserves private occurrence context',async()=>{mocks.directory.mockResolvedValue({rows:[{companyId:'team',companyName:'Example team',sessionId:'session',title:'Private meeting',meetingId:'private',date:'2026-11-13',joined:false}]});render(<LiveMeetingLink/>);const user=userEvent.setup();await user.click(await screen.findByRole('button',{name:'Live Meetings (1)'}));expect(screen.getByText('Private meeting')).toBeTruthy();await user.click(screen.getByRole('button',{name:'Join'}));expect(mocks.setTeam).toHaveBeenCalledWith('team');expect(mocks.nav).toHaveBeenCalledWith('/meetings/private?date=2026-11-13&session=session')})
it('does not offer a join action when no meetings are returned',async()=>{mocks.directory.mockResolvedValue({rows:[]});render(<LiveMeetingLink/>);await userEvent.setup().click(screen.getByRole('button',{name:'Live Meetings'}));await screen.findByText('No live meetings are available to you.');expect(screen.queryByRole('button',{name:'Join'})).toBeNull()})
