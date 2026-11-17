// @vitest-environment jsdom
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import {afterEach,it,expect,vi} from 'vitest'
import {rowEditor} from './rowEditor'
afterEach(cleanup)
it('opens on background clicks and keyboard activation only',()=>{const open=vi.fn();render(<div data-testid="row" {...rowEditor(open)}><span>Owner</span><button>Complete</button><a href="#">Link</a><input aria-label="Value"/><div role="button">Menu</div></div>);fireEvent.click(screen.getByText('Owner'));expect(open).toHaveBeenCalledTimes(1);for(const target of [screen.getByText('Complete'),screen.getByText('Link'),screen.getByLabelText('Value'),screen.getByText('Menu')]){fireEvent.click(target);fireEvent.keyDown(target,{key:'Enter'})}expect(open).toHaveBeenCalledTimes(1);fireEvent.keyDown(screen.getByTestId('row'),{key:'Enter'});fireEvent.keyDown(screen.getByTestId('row'),{key:' '});expect(open).toHaveBeenCalledTimes(3)})
it('does not attach edit actions to read-only rows',()=>{expect(rowEditor(vi.fn(),true)).toEqual({})})
