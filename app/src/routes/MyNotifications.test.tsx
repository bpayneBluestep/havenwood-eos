// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {render,screen,cleanup,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
const state=vi.hoisted(()=>({current:{me:{id:'a'}}}))
vi.mock('../state',()=>({useApp:()=>state.current}))
import MyNotifications from './MyNotifications'
beforeEach(()=>{localStorage.clear();state.current={me:{id:'a'}}})
afterEach(cleanup)
it('shows default email choices and clearly states that delivery is disconnected',()=>{render(<MyNotifications/>);expect((screen.getByLabelText('Assignment: Email') as HTMLInputElement).checked).toBe(true);expect((screen.getByLabelText('Assignment: Text') as HTMLInputElement).checked).toBe(false);expect((screen.getByLabelText('Days') as HTMLInputElement).value).toBe('3');expect(screen.getByText('No emails or texts will be sent.')).toBeTruthy()})
it('retains browser drafts only for the same user and supports extra reminder steps',async()=>{const user=userEvent.setup();const view=render(<MyNotifications/>);await user.click(screen.getByLabelText('Assignment: Text'));await user.click(screen.getByRole('button',{name:'+ Add reminder'}));const rule=screen.getByRole('group',{name:'Reminder 2'});await user.selectOptions(within(rule).getByLabelText('When'),'on');expect(within(rule).queryByLabelText('Days')).toBeNull();view.unmount();render(<MyNotifications/>);expect((screen.getByLabelText('Assignment: Text') as HTMLInputElement).checked).toBe(true);expect(screen.getByRole('group',{name:'Reminder 2'})).toBeTruthy();cleanup();state.current={me:{id:'b'}};render(<MyNotifications/>);expect((screen.getByLabelText('Assignment: Text') as HTMLInputElement).checked).toBe(false);expect(screen.queryByRole('group',{name:'Reminder 2'})).toBeNull()})
it('recovers from an invalid saved draft',()=>{localStorage.setItem('eos:notification-draft:v1:a','{"assignment":{}}');render(<MyNotifications/>);expect((screen.getByLabelText('Assignment: Email') as HTMLInputElement).checked).toBe(true)})
