// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest'
import {cleanup,render,screen} from '@testing-library/react'
import {defaultMeetingTypes} from '../../../platform/meetingTypes'
vi.mock('./useAgendaAutosave',()=>({useAgendaAutosave:()=>({catalog:{rev:1,types:defaultMeetingTypes()},error:null,busy:false,dirty:false,change:vi.fn(),flush:vi.fn()})}))
import MeetingTypesAdmin from './MeetingTypesAdmin'
afterEach(cleanup)
it('offers Vision & Plan as an explicit content choice while retaining the current default',()=>{
 render(<MeetingTypesAdmin teams={[{id:'team-a',name:'Team A'}]}/>);
 const select=screen.getByLabelText('Section 1 content') as HTMLSelectElement;
 expect([...select.options].find(option=>option.value==='vision')?.textContent).toBe('Vision & Plan');
 expect(select.value).toBe('segue');
});
