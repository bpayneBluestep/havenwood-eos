// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest'
import {render,screen,cleanup,fireEvent,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
const api=vi.hoisted(()=>({getMemberProfile:vi.fn(),saveMemberProfile:vi.fn()}))
const reload=vi.hoisted(()=>vi.fn())
vi.mock('../api',async()=>({...await vi.importActual('../api'),...api}))
vi.mock('../state',()=>({useApp:()=>({me:{id:'member',name:'First Last'},reload})}))
import MyProfile,{MemberProfileEditor} from './MyProfile'
import {Avatar,PersonName} from '../lib/ui'
import {MemberProfilesContext} from '../lib/memberProfiles'
const reply={personId:'member',fullName:'First Last',profile:{preferredName:'Alex',photo:'',rev:2}}
beforeEach(()=>{vi.clearAllMocks();api.getMemberProfile.mockResolvedValue(reply);api.saveMemberProfile.mockResolvedValue({...reply,profile:{...reply.profile,preferredName:'New',rev:3}})})
afterEach(cleanup)
it('loads and saves a server profile with its revision',async()=>{render(<MyProfile/>);const input=await screen.findByLabelText('Preferred first name');fireEvent.change(input,{target:{value:'New'}});await userEvent.setup().click(screen.getByRole('button',{name:'Save profile'}));await screen.findByText('Profile saved.');expect(api.getMemberProfile).toHaveBeenCalledWith(undefined);expect(api.saveMemberProfile).toHaveBeenCalledWith({preferredName:'New',photo:'',rev:2},undefined);expect(reload).toHaveBeenCalled()})
it('keeps edits after a failed save',async()=>{api.saveMemberProfile.mockRejectedValue(new Error('This profile changed. Reload before saving.'));render(<MyProfile/>);fireEvent.change(await screen.findByLabelText('Preferred first name'),{target:{value:'My edit'}});await userEvent.setup().click(screen.getByRole('button',{name:'Save profile'}));await screen.findByText(/Reload before saving/);expect((screen.getByLabelText('Preferred first name') as HTMLInputElement).value).toBe('My edit')})
it('rejects unsupported uploads before decoding or saving',async()=>{render(<MyProfile/>);const input=await screen.findByLabelText('Profile photo');fireEvent.change(input,{target:{files:[new File(['<svg/>'],'photo.svg',{type:'image/svg+xml'})]}});await screen.findByText('Choose a JPEG, PNG, or WebP photo.');expect(api.saveMemberProfile).not.toHaveBeenCalled()})
it('uses preferred names and photos while retaining full accessible names and fallback initials',async()=>{const photo='data:image/jpeg;base64,fixture';render(<MemberProfilesContext.Provider value={{enabled:true,profiles:{member:{preferredName:'Alex',photo,rev:1}},people:[{id:'member',name:'First Last'}]}}><PersonName id="member" name="First Last"/><Avatar id="member" name="First Last"/></MemberProfilesContext.Provider>);expect(screen.getByText('Alex').getAttribute('aria-label')).toBe('First Last');const image=document.querySelector('img')!;expect(image.getAttribute('src')).toBe(photo);fireEvent.error(image);await waitFor(()=>expect(document.querySelector('img')).toBeNull());expect(screen.getByText('FL')).toBeTruthy()})
it('keeps duplicate-name people separate by identity',()=>{render(<MemberProfilesContext.Provider value={{enabled:true,profiles:{one:{preferredName:'Alex',photo:'',rev:1},two:{preferredName:'Sam',photo:'',rev:1}},people:[{id:'one',name:'First Last'},{id:'two',name:'First Last'}]}}><PersonName id="one" name="First Last"/><PersonName id="two" name="First Last"/><Avatar name="First Last"/></MemberProfilesContext.Provider>);expect(screen.getByText('Alex')).toBeTruthy();expect(screen.getByText('Sam')).toBeTruthy();expect(screen.getByText('FL')).toBeTruthy()})

it('lets an admin edit a selected staff profile without requiring a team context',async()=>{render(<MemberProfileEditor personId="other" embedded/>);await screen.findByLabelText('Preferred first name');expect(api.getMemberProfile).toHaveBeenCalledWith('other');fireEvent.change(screen.getByLabelText('Preferred first name'),{target:{value:'Admin edit'}});await userEvent.setup().click(screen.getByRole('button',{name:'Save profile'}));await waitFor(()=>expect(api.saveMemberProfile).toHaveBeenCalledWith({preferredName:'Admin edit',photo:'',rev:2},'other'))})
