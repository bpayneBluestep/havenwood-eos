// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest'
import {cleanup,render,screen} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import type {LiveSessionView} from '../../../platform/liveSessionModel'
const api=vi.hoisted(()=>({getLiveSessions:vi.fn(),liveSessionAction:vi.fn(),getMeetingTypes:vi.fn(),sendMeetingPresence:vi.fn()}))
vi.mock('../api',()=>api)
vi.mock('../state',()=>({useApp:()=>({me:{id:'host'},liveMeetings:true,teams:{},team:[],company:{id:'team & one'},multiCompany:false})}))
vi.mock('./MeetingNotes',()=>({default:()=>null}))
vi.mock('./MeetingAttendees',()=>({default:()=>null}))
vi.mock('../routes/L10',()=>({default:()=>null}))
vi.mock('../routes/Issues',()=>({default:()=>null}))
vi.mock('../lib/TeamSelector',()=>({default:()=>null}))
vi.mock('../lib/ui',()=>({PersonName:({name}:{name:string})=><span>{name}</span>,Modal:()=>null}))
import LiveMeetings from './LiveMeetings'
const session:LiveSessionView={id:'session / one',companyId:'team & one',title:'Example meeting',meetingId:'',date:'2026-11-18',hostId:'host',hostName:'Example host',status:'ended',startedAt:1000,endedAt:6000,activeStartedAt:null,activeIndex:0,sections:[{id:'conclude',kind:'conclude',label:'Conclusion',minutes:5,spentMs:5000}],rev:2,joined:true,canControl:true,serverNow:6000,participants:[]}
async function open(value:LiveSessionView){api.getMeetingTypes.mockResolvedValue({types:[]});api.getLiveSessions.mockResolvedValue({sessions:[value],serverNow:6000});render(<MemoryRouter><LiveMeetings companyId={value.companyId} requestedSessionId={value.id}/></MemoryRouter>);await screen.findByRole('heading',{name:'Archived items'})}
afterEach(()=>{cleanup();vi.clearAllMocks()})
it('links the ended recap to its team and source-session archive filter',async()=>{await open({...session,completionArchive:{headline:0,todo:1,issue:0,skipped:0,items:[{kind:'todo',id:'item',title:'Saved task',ownerName:'Example owner',dueDate:'2026-11-20',archivedAt:'2026-11-18'}]}});expect(screen.getByRole('link',{name:'View this meeting in team archive'}).getAttribute('href')).toBe('/archive?team=team%20%26%20one&meetingId=session%20%2F%20one');expect(screen.getByText('Saved task')).toBeTruthy();expect(screen.getByText(/Later restores do not change this history/)).toBeTruthy();expect(api.liveSessionAction).not.toHaveBeenCalled()})
it('labels a missing legacy list without treating it as zero archived items',async()=>{await open({...session,completionArchive:{headline:1,todo:0,issue:0,skipped:0}});expect(screen.getByText('This older recap does not include an archived-item list.')).toBeTruthy();expect(screen.getByText(/Archive source details were not recorded/)).toBeTruthy()})
it('labels old recaps with no archive history and does not write or backfill',async()=>{await open(session);expect(screen.getByText(/Archive history was not captured/)).toBeTruthy();expect(api.liveSessionAction).not.toHaveBeenCalled()})
it('does not label a newly captured empty archive as unknown history',async()=>{await open({...session,completionArchive:{headline:0,todo:0,issue:0,skipped:0,items:[],archiveSource:{kind:'meeting-end',sessionId:session.id,teamId:session.companyId,actorId:'host',archivedAt:'2026-11-18',endedAt:6000,policy:'checked-visible-v2'}}});expect(screen.getByText('No checked ordinary items were eligible for archival.')).toBeTruthy();expect(screen.queryByText(/Archive source details were not recorded/)).toBeNull()})
