import {describe, it, expect} from 'vitest'
import {compareDates, compareNames, isOverdue, newestPeriods, priorityLabel} from './listModel'
import {calculateRockStatus} from '../../../platform/rockStatus'
describe('automatic Rock status', () => {
 const today = '2026-11-12'
 const rock = (milestones: {done:boolean; dueDate:string}[], status:'on_track'|'off_track'|'done' = 'on_track') => ({milestones,status})
 it('keeps empty Rocks manual', () => {expect(calculateRockStatus(rock([], 'done'), today)).toBe('done'); expect(calculateRockStatus(rock([], 'off_track'), today)).toBe('off_track')})
 it('completes Rocks only when all milestones are complete', () => {expect(calculateRockStatus(rock([{done:true,dueDate:'2026-01-01'}]), today)).toBe('done')})
 it('ignores completed overdue milestones', () => {expect(calculateRockStatus(rock([{done:true,dueDate:'2026-01-01'},{done:false,dueDate:''}]), today)).toBe('on_track')})
 it('marks incomplete past dates off track', () => {expect(calculateRockStatus(rock([{done:false,dueDate:'2026-11-11'}]), today)).toBe('off_track')})
 it('treats today and undated milestones as on track', () => {expect(calculateRockStatus(rock([{done:false,dueDate:today},{done:false,dueDate:''}]), today)).toBe('on_track')})
 it('recovers after a due date changes or a milestone reopens', () => {expect(calculateRockStatus(rock([{done:false,dueDate:'2026-11-13'}], 'off_track'), today)).toBe('on_track');expect(calculateRockStatus(rock([{done:false,dueDate:'2026-11-11'}], 'done'), today)).toBe('off_track')})
 it('changes status when the next day begins', () => {const item=rock([{done:false,dueDate:today}]);expect(calculateRockStatus(item,today)).toBe('on_track');expect(calculateRockStatus(item,'2026-11-13')).toBe('off_track')})
})
describe('list controls', () => {
 it('sorts full display names and puts missing owners last', () => {expect(['', 'Zulu, Alex', 'Alpha, Blair'].sort(compareNames)).toEqual(['Zulu, Alex','Alpha, Blair',''])})
 it('puts missing dates last in both date directions', () => {const dates=['2026-11-10',null,'2026-11-12'];expect([...dates].sort(compareDates)).toEqual(['2026-11-10','2026-11-12',null]);expect([...dates].sort((a,b)=>compareDates(a,b,true))).toEqual(['2026-11-12','2026-11-10',null])})
 it('excludes completed, today, future and undated items from overdue', () => {expect(isOverdue({status:'open',dueDate:'2026-11-11'},'2026-11-12')).toBe(true);for(const dueDate of [null,'2026-11-12','2026-11-13'])expect(isOverdue({status:'open',dueDate},'2026-11-12')).toBe(false);expect(isOverdue({status:'done',dueDate:'2026-11-11'},'2026-11-12')).toBe(false)})
 it('uses saved importance rather than row position', () => {expect(priorityLabel(1)).toBe('1 — Lowest');expect(priorityLabel(5)).toBe('5 — Highest');expect(priorityLabel(null)).toBe('Unranked');expect(priorityLabel(9)).toBe('Unranked')})
 it('orders periods newest first without mutating the source', () => {const periods=['2026-10-26','2026-11-09','2026-11-02'];expect(newestPeriods(periods)).toEqual(['2026-11-09','2026-11-02','2026-10-26']);expect(periods[0]).toBe('2026-10-26')})
})
