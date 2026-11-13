// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {useAgendaAutosave} from './useAgendaAutosave'
import {defaultMeetingTypes} from '../../../platform/meetingTypes'
import type {MeetingTypeCatalog} from '../../../platform/meetingTypes'
const api=vi.hoisted(()=>({read:vi.fn(),save:vi.fn()}))
vi.mock('../api',()=>({adminMeetingTypes:api.read,adminSaveMeetingTypes:api.save}))
const initial=()=>({rev:0,types:defaultMeetingTypes()})
function Editor({teamId='team'}:{teamId?:string}){
 const {catalog,change,flush,busy,dirty,error}=useAgendaAutosave(teamId)
 return <div>{catalog&&<input aria-label="Section" value={catalog.types[0].sections[0].label} onChange={event=>change(current=>({...current,types:current.types.map((type,index)=>index?type:{...type,sections:type.sections.map((section,i)=>i?section:{...section,label:event.target.value})})}))} onBlur={()=>void flush()}/>}<span role="status">{busy?'Saving':dirty?'Pending':'Saved'}</span>{error&&<p role="alert">{error}</p>}<button onClick={()=>void flush()}>Retry</button></div>
}
beforeEach(()=>{api.read.mockReset().mockResolvedValue(initial());api.save.mockReset().mockImplementation(async(_team,catalog)=>({...catalog,rev:catalog.rev+1}))})
afterEach(cleanup)
it('automatically saves after a pause and flushes a field on blur',async()=>{
 render(<Editor/>);fireEvent.change(await screen.findByLabelText('Section'),{target:{value:'Opening'}});expect(api.save).not.toHaveBeenCalled();await waitFor(()=>expect(api.save).toHaveBeenCalledTimes(1));await waitFor(()=>expect(screen.getByRole('status').textContent).toBe('Saved'))
 fireEvent.change(screen.getByLabelText('Section'),{target:{value:'Opening update'}});fireEvent.blur(screen.getByLabelText('Section'));await waitFor(()=>expect(api.save).toHaveBeenCalledTimes(2));expect(api.save.mock.calls[1][1].rev).toBe(1)
})
it('serializes writes and keeps newer edits while a save is in flight',async()=>{
 let finish!:(value:MeetingTypeCatalog)=>void
 api.save.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
 render(<Editor/>);fireEvent.change(await screen.findByLabelText('Section'),{target:{value:'First'}});fireEvent.blur(screen.getByLabelText('Section'));await waitFor(()=>expect(api.save).toHaveBeenCalledTimes(1))
 fireEvent.change(screen.getByLabelText('Section'),{target:{value:'Second'}});fireEvent.blur(screen.getByLabelText('Section'));expect(api.save).toHaveBeenCalledTimes(1)
 const first=api.save.mock.calls[0][1];await act(async()=>finish({...first,rev:7}))
 await waitFor(()=>expect(api.save).toHaveBeenCalledTimes(2));expect(api.save.mock.calls[1][1].rev).toBe(7);expect(api.save.mock.calls[1][1].types[0].sections[0].label).toBe('Second');expect((screen.getByLabelText('Section') as HTMLInputElement).value).toBe('Second');await waitFor(()=>expect(screen.getByRole('status').textContent).toBe('Saved'))
})
it('keeps invalid partial edits local and saves once corrected',async()=>{
 render(<Editor/>);fireEvent.change(await screen.findByLabelText('Section'),{target:{value:''}});fireEvent.blur(screen.getByLabelText('Section'));await screen.findByRole('alert');expect(api.save).not.toHaveBeenCalled();expect((screen.getByLabelText('Section') as HTMLInputElement).value).toBe('')
 fireEvent.change(screen.getByLabelText('Section'),{target:{value:'Corrected'}});fireEvent.blur(screen.getByLabelText('Section'));await waitFor(()=>expect(api.save).toHaveBeenCalledTimes(1))
})
it('retains failed input and retries without claiming it was saved',async()=>{
 api.save.mockRejectedValueOnce(new Error('Save failed'))
 render(<Editor/>);fireEvent.change(await screen.findByLabelText('Section'),{target:{value:'Keep this'}});fireEvent.blur(screen.getByLabelText('Section'));await screen.findByText('Save failed');expect((screen.getByLabelText('Section') as HTMLInputElement).value).toBe('Keep this');expect(screen.getByRole('status').textContent).toBe('Pending');fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(api.save).toHaveBeenCalledTimes(2));await waitFor(()=>expect(screen.getByRole('status').textContent).toBe('Saved'))
})
it('ignores a late save reply after the team context changes',async()=>{
 let finish!:(value:MeetingTypeCatalog)=>void
 api.save.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
 const view=render(<Editor teamId="first"/>);fireEvent.change(await screen.findByLabelText('Section'),{target:{value:'First team draft'}});fireEvent.blur(screen.getByLabelText('Section'));await waitFor(()=>expect(api.save).toHaveBeenCalledTimes(1));const payload=api.save.mock.calls[0][1]
 view.rerender(<Editor teamId="second"/>);await waitFor(()=>expect((screen.getByLabelText('Section') as HTMLInputElement).value).toBe('Segue'));await act(async()=>finish({...payload,rev:9}));expect((screen.getByLabelText('Section') as HTMLInputElement).value).toBe('Segue');expect(api.save).toHaveBeenCalledTimes(1)
})
