// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from 'vitest'
import {render,screen,fireEvent,cleanup,within} from '@testing-library/react'
import AccountabilityChart from './AccountabilityChart'
import type {AccountabilityChartProps} from './AccountabilityChart'
afterEach(cleanup)
const seat=(id:string,parentSeatId='',state='vacant')=>({id,kind:'tenk_seat',companyId:'company',rev:1,schemaVersion:1,createdAt:'2026-01-01',updatedAt:'2026-01-01',editorId:'person',archived:false,data:{title:id,parentSeatId,state,teamId:'',mission:'A long purpose statement '.repeat(20),mco:'Outcome',responsibilities:[],drivers:[],obsessions:[],sections:[],interimPersonId:'',targetDate:'',links:[],sourceText:'',displayOrder:0}}) as AccountabilityChartProps['seats'][number]
function props():AccountabilityChartProps{return {seats:[seat('Root'),seat('Child','Root'),seat('Other')],assignments:[],people:[],teams:[],canEdit:true,onOpen:vi.fn(),onMove:vi.fn()}}
describe('AccountabilityChart',()=>{
 it('collapses and focuses branches while preserving zoom on parent rerender',()=>{const p=props(),view=render(<AccountabilityChart {...p}/>);fireEvent.click(screen.getByRole('button',{name:'Zoom chart in'}));expect(screen.getByLabelText('Chart zoom').textContent).toBe('110%');fireEvent.click(screen.getByRole('button',{name:'Collapse Root'}));expect(screen.queryByRole('button',{name:'Open Child'})).toBeNull();view.rerender(<AccountabilityChart {...p}/>);expect(screen.getByLabelText('Chart zoom').textContent).toBe('110%');expect(screen.queryByRole('button',{name:'Open Child'})).toBeNull()})
 it('search expands the ancestors of a collapsed result',()=>{const p=props(),view=render(<AccountabilityChart {...p}/>);fireEvent.click(screen.getByRole('button',{name:'Collapse Root'}));view.rerender(<AccountabilityChart {...p} query="Child"/>);expect(screen.getByRole('button',{name:'Open Child'})).toBeTruthy()})
 it('requires an explicit save before calling the move endpoint',async()=>{const p=props();render(<AccountabilityChart {...p}/>);fireEvent.click(within(screen.getByRole('button',{name:'Open Child'}).closest('article')!).getByRole('button',{name:'Move'}));expect(p.onMove).not.toHaveBeenCalled();fireEvent.change(screen.getByRole('combobox',{name:'Reports to'}),{target:{value:''}});fireEvent.click(screen.getByRole('button',{name:'Save move'}));expect(p.onMove).toHaveBeenCalledWith('Child','')})
 it('displays distinct planned and vacant states and hides move for readers',()=>{const p=props();render(<AccountabilityChart {...p} seats={[seat('Future','','planned'),seat('Empty')]} canEdit={false}/>);expect(screen.getByText('Planned hire')).toBeTruthy();expect(screen.getByText('Vacant')).toBeTruthy();expect(screen.queryByRole('button',{name:'Move'})).toBeNull()})
})
