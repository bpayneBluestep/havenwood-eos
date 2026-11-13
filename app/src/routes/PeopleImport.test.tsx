// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from 'vitest'
import {cleanup,render,screen,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PeopleImport from './PeopleImport'
import {buildPeopleImportPreview} from '../../../platform/peopleImport'
import {sourceSnapshot} from '../../../platform/peopleDirectory'
afterEach(cleanup)
const source=sourceSnapshot([{id:'p1',fullName:'Person A',firstLast:'Person A',email:'person@example.com'}],true)
const preview=buildPeopleImportPreview(source,{rev:0,people:[]},['fullName','firstLast','email'])
const companies=[{id:'company',name:'Company A'}]
describe('reviewed people import',()=>{
 it('requires source preview and explicit review before applying selected fields',async()=>{
  const loadPreview=vi.fn().mockResolvedValue(preview),applyPreview=vi.fn().mockResolvedValue({noOp:false,appliedCount:1,rev:1,unresolvedIds:[]});render(<PeopleImport companies={companies} loadPreview={loadPreview} applyPreview={applyPreview}/>);const user=userEvent.setup()
  expect((screen.getByRole('button',{name:'Review source changes'}) as HTMLButtonElement).disabled).toBe(true)
  await user.selectOptions(screen.getByRole('combobox',{name:'Company'}),'company');await user.click(screen.getByRole('button',{name:'Review source changes'}));await screen.findByText('Person A')
  expect(loadPreview).toHaveBeenCalledWith('company',['fullName','firstLast','email']);expect((screen.getByRole('button',{name:'Apply reviewed source fields'}) as HTMLButtonElement).disabled).toBe(true)
  await user.click(screen.getByRole('checkbox',{name:'I reviewed the source changes and the selected fields.'}));await user.click(screen.getByRole('button',{name:'Apply reviewed source fields'}));await waitFor(()=>expect(applyPreview).toHaveBeenCalledWith({scopeCompanyId:'company',token:preview.token,rev:0,fields:preview.fields}));await screen.findByText(/Saved 1 source snapshot update/)
 })
 it('invalidates a preview when selected fields change',async()=>{
  const loadPreview=vi.fn().mockResolvedValue(preview);render(<PeopleImport companies={companies} loadPreview={loadPreview} applyPreview={vi.fn()}/>);const user=userEvent.setup();await user.selectOptions(screen.getByRole('combobox',{name:'Company'}),'company');await user.click(screen.getByRole('button',{name:'Review source changes'}));await screen.findByText('Person A');await user.click(screen.getByRole('checkbox',{name:'Source email'}));expect(screen.queryByRole('button',{name:'Apply reviewed source fields'})).toBeNull();expect(screen.queryByText('Person A')).toBeNull();await user.click(screen.getByRole('button',{name:'Review source changes'}));await waitFor(()=>expect(loadPreview).toHaveBeenLastCalledWith('company',['fullName','firstLast']))
 })
 it('retains the reviewed rows after an apply failure and shows the error',async()=>{
  const applyPreview=vi.fn().mockRejectedValue(Error('Source changed. Review again.'));render(<PeopleImport companies={companies} loadPreview={vi.fn().mockResolvedValue(preview)} applyPreview={applyPreview}/>);const user=userEvent.setup();await user.selectOptions(screen.getByRole('combobox',{name:'Company'}),'company');await user.click(screen.getByRole('button',{name:'Review source changes'}));await screen.findByText('Person A');await user.click(screen.getByRole('checkbox',{name:'I reviewed the source changes and the selected fields.'}));await user.click(screen.getByRole('button',{name:'Apply reviewed source fields'}));await screen.findByText('Source changed. Review again.');expect(screen.getByText('Person A')).toBeTruthy()
 })
})
