// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {cleanup,render,screen,waitFor,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const api=vi.hoisted(()=>({notifyTestSend:vi.fn(),notifyTestRecent:vi.fn()}))
vi.mock('../api',()=>api)
vi.mock('../state',()=>({useApp:()=>({me:{id:'a',email:'admin@example.com'}})}))
import NotifyTesting from './NotifyTesting'

beforeEach(()=>{api.notifyTestSend.mockReset();api.notifyTestRecent.mockReset();api.notifyTestRecent.mockResolvedValue([])})
afterEach(cleanup)

it('prefills the email with the admin address and leaves the text number blank',async()=>{
 render(<NotifyTesting/>)
 expect((screen.getByLabelText('Email to') as HTMLInputElement).value).toBe('admin@example.com')
 expect((screen.getByLabelText('Text to') as HTMLInputElement).value).toBe('')
 await screen.findByText('No test sends yet.')
})

it('refuses a bad phone number without calling the endpoint',async()=>{
 const user=userEvent.setup()
 render(<NotifyTesting/>)
 await user.type(screen.getByLabelText('Text to'),'555-0100')
 await user.click(screen.getByRole('button',{name:'Send test text'}))
 expect(screen.getByRole('alert').textContent).toMatch(/10 digits/)
 expect(api.notifyTestSend).not.toHaveBeenCalled()
})

it('sends an email, shows its status and adds it to recent sends',async()=>{
 const user=userEvent.setup()
 api.notifyTestSend.mockResolvedValue({id:'1',channel:'email',to:'admin@example.com',subject:'TenK test email',message:'x',at:'2026-11-23T17:00:00Z',status:'pending',detail:'Saved. Waiting for the notification sender to process it.'})
 render(<NotifyTesting/>)
 await screen.findByText('No test sends yet.')
 await user.click(screen.getByRole('button',{name:'Send test email'}))
 expect(api.notifyTestSend).toHaveBeenCalledWith({channel:'email',to:'admin@example.com',subject:'TenK test email',message:'This is a test email from TenK.'})
 const card=screen.getByRole('group',{name:'Test email'})
 await waitFor(()=>expect(within(card).getByRole('status').textContent).toMatch(/Waiting/))
 expect(screen.getByRole('table')).toBeTruthy()
})

it('sends a text with the number as typed (the endpoint normalizes it)',async()=>{
 const user=userEvent.setup()
 api.notifyTestSend.mockResolvedValue({id:'7',channel:'text',to:'5552010142',subject:'',message:'[TenK test] hi',at:'2026-11-23T17:00:00Z',status:'sent',detail:'Accepted by Twilio.'})
 render(<NotifyTesting/>)
 await user.type(screen.getByLabelText('Text to'),'(555) 201-0142')
 await user.click(screen.getByRole('button',{name:'Send test text'}))
 expect(api.notifyTestSend).toHaveBeenCalledWith({channel:'text',to:'(555) 201-0142',subject:undefined,message:'This is a test text from TenK.'})
 await screen.findByText('(555) 201-0142')
})
