// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import PlanHorizonField from './PlanHorizonField'
afterEach(cleanup)
it('keeps a failed year change for retry and rejects incomplete years',async()=>{
 const save=vi.fn().mockRejectedValue(Error('Record changed.'));render(<PlanHorizonField kind="year" value={2026} editable onSave={save}/>);fireEvent.click(screen.getByRole('button'));const input=screen.getByLabelText('1-year target year');fireEvent.change(input,{target:{value:'20'}});fireEvent.blur(input);expect(save).not.toHaveBeenCalled();expect(screen.getByText('Enter a year from 1900 to 9999.')).toBeTruthy();fireEvent.change(input,{target:{value:'2028'}});fireEvent.blur(input);await screen.findByText('Record changed.');expect((input as HTMLInputElement).value).toBe('2028');
});
it('does not offer editing controls to readers',()=>{render(<PlanHorizonField kind="date" value="2029-12-31" editable={false} onSave={vi.fn()}/>);expect(screen.queryByRole('button')).toBeNull();expect(screen.getByText(/Target:/)).toBeTruthy()});
