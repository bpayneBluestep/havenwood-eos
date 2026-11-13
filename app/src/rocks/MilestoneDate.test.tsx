// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react'
import MilestoneDate from './MilestoneDate'
import type {Milestone} from '../api'
const item:Milestone={id:'m',title:'Example milestone',ownerId:'a',dueDate:'2026-12-01',done:false,completedAt:null}
afterEach(cleanup)
it('automatically saves a changed date without Save or Cancel buttons',async()=>{const save=vi.fn().mockResolvedValue(undefined);render(<MilestoneDate item={item} onSave={save}/>);fireEvent.click(screen.getByRole('button',{name:'Edit due date for Example milestone'}));expect(screen.queryByRole('button',{name:'Save'})).toBeNull();expect(screen.queryByRole('button',{name:'Cancel'})).toBeNull();fireEvent.change(screen.getByLabelText('Due date for Example milestone'),{target:{value:'2026-12-12'}});await waitFor(()=>expect(save).toHaveBeenCalledWith('2026-12-12'))})
it('flushes a date change on blur and does not write twice',async()=>{const save=vi.fn().mockResolvedValue(undefined);render(<MilestoneDate item={item} onSave={save}/>);fireEvent.click(screen.getByRole('button',{name:'Edit due date for Example milestone'}));const input=screen.getByLabelText('Due date for Example milestone');fireEvent.change(input,{target:{value:''}});fireEvent.blur(input);await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));expect(save).toHaveBeenCalledWith('')})
it('retains the input and error when automatic saving fails',async()=>{const save=vi.fn().mockRejectedValue(new Error('Example conflict'));render(<MilestoneDate item={item} onSave={save}/>);fireEvent.click(screen.getByRole('button',{name:'Edit due date for Example milestone'}));const input=screen.getByLabelText('Due date for Example milestone');fireEvent.change(input,{target:{value:'2026-12-12'}});fireEvent.blur(input);await screen.findByRole('alert');expect((input as HTMLInputElement).value).toBe('2026-12-12')})
