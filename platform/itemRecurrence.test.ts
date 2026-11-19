import {describe,expect,it} from 'vitest'
import {defaultRecurrence,normalizeRecurrence,nextOccurrence,planRecurringCompletion,recurrenceLabel} from './itemRecurrence'

describe('itemRecurrence',()=>{
 it('builds weekly defaults from the start weekday',()=>{
  const row=defaultRecurrence('2026-11-18','weekly')
  expect(row.freq).toBe('weekly')
  expect(row.interval).toBe(1)
  expect(row.weekdays).toEqual([3]) // Wednesday
  expect(row.until).toBeNull()
  expect(row.seriesId).toMatch(/^series_/)
 })

 it('normalizes presets and rejects bad custom weekdays',()=>{
  expect(normalizeRecurrence({freq:'weekly',start:'2026-11-18'},'2026-11-18')).toMatchObject({freq:'weekly',weekdays:[3]})
  expect(normalizeRecurrence({freq:'off'},'2026-11-18')).toBeNull()
  expect(()=>normalizeRecurrence({freq:'custom',start:'2026-11-18',weekdays:[]},'2026-11-18')).toThrow(/weekday/)
 })

 it('advances weekly, biweekly and monthly cadences',()=>{
  const weekly=defaultRecurrence('2026-11-18','weekly')
  expect(nextOccurrence('2026-11-18',weekly)).toBe('2026-11-25')
  const bi=defaultRecurrence('2026-11-18','biweekly')
  expect(nextOccurrence('2026-11-18',bi)).toBe('2026-12-02')
  const monthly=defaultRecurrence('2026-01-31','monthly')
  expect(nextOccurrence('2026-01-31',monthly)).toBe('2026-02-28')
 })

 it('stops after until and plans archive-plus-spawn completion',()=>{
  const weekly={...defaultRecurrence('2026-11-18','weekly'),until:'2026-11-20'}
  expect(nextOccurrence('2026-11-18',weekly)).toBeNull()
  const open={...defaultRecurrence('2026-11-18','weekly'),until:null}
  expect(planRecurringCompletion('todo',open,'2026-11-18','2026-11-18')).toEqual({
   archiveCurrent:true,
   completeStatus:'done',
   nextDueDate:'2026-11-25',
   recurrence:open,
  })
  expect(planRecurringCompletion('todo',null,'2026-11-18','2026-11-18')).toBeNull()
 })

 it('labels cadences for the UI',()=>{
  expect(recurrenceLabel(defaultRecurrence('2026-11-18','weekly'))).toBe('Weekly on Wed')
  expect(recurrenceLabel(defaultRecurrence('2026-11-18','monthly'))).toBe('Monthly')
  expect(recurrenceLabel(normalizeRecurrence({freq:'custom',start:'2026-11-18',weekdays:[1,3]},'2026-11-18'))).toBe('Weekly on Mon, Wed')
 })
})
