import {describe,it,expect} from 'vitest'
import {todoTrackRecord,trackRecordStart} from './todoTrackRecord'
const members=[{id:'a',name:'Member A'},{id:'b',name:'Member B'}],today='2026-11-12'
const todo=(extra:Record<string,unknown>={})=>({ownerId:'a',status:'done',dueDate:'2026-11-10',completedAt:'2026-11-10T18:00:00',...extra})
describe('all-time on-time track record',()=>{
 it('includes on-time, late and overdue open items while excluding future open work',()=>{const rows=todoTrackRecord(members,[todo(),todo({completedAt:'2026-11-11'}),todo({status:'open',completedAt:null}),todo({status:'open',dueDate:'2026-12-01',completedAt:null})],today);expect(rows[0]).toMatchObject({onTime:1,scored:3,rate:1/3});expect(rows[1].rate).toBeNull()})
 it('counts completion on the due date and early future-due completions',()=>{expect(todoTrackRecord(members,[todo(),todo({dueDate:'2026-11-20',completedAt:'2026-11-11'})],today)[0]).toMatchObject({onTime:2,scored:2,rate:1})})
 it('keeps archived completions and overdue commitments after archive',()=>{expect(todoTrackRecord(members,[todo({archivedAt:'2026-11-11'}),todo({status:'open',completedAt:null,archivedAt:'2026-11-11'})],today)[0]).toMatchObject({onTime:1,scored:2,rate:.5})})
 it('excludes open items cancelled before or on their deadline',()=>{expect(todoTrackRecord(members,[todo({status:'open',completedAt:null,archivedAt:'2026-11-09'}),todo({status:'open',completedAt:null,archivedAt:'2026-11-10'})],today)[0].scored).toBe(0)})
 it('does not reveal personal or private meeting work through aggregates',()=>{expect(todoTrackRecord(members,[todo({personal:true}),todo({meetingId:'private'})],today)[0]).toMatchObject({scored:0,unscored:0,rate:null})})
 it('marks missing or invalid history as unscored instead of inventing completions',()=>{expect(todoTrackRecord(members,[todo({completedAt:null}),todo({dueDate:''}),todo({completedAt:'2026-02-30'})],today)[0]).toMatchObject({scored:0,unscored:3,rate:null})})
 it('does not score an unfinished item until its deadline has passed',()=>{expect(todoTrackRecord(members,[todo({status:'open',completedAt:null,dueDate:today})],today)[0].scored).toBe(0)})
 it('includes every current member and ignores other owners',()=>{const rows=todoTrackRecord(members,[todo({ownerId:'former'})],today);expect(rows.map(row=>row.id)).toEqual(['a','b']);expect(rows.every(row=>row.rate===null)).toBe(true)})
})

it('uses due-date windows and retains late completions in the original cohort',()=>{expect(todoTrackRecord(members,[todo({dueDate:'2026-08-11'}),todo({dueDate:'2026-08-12',completedAt:'2026-11-01'}),todo({dueDate:'2026-11-20'})],today,'3m')[0]).toMatchObject({onTime:0,scored:1});expect(todoTrackRecord(members,[todo({dueDate:'2026-10-11'}),todo()],today,'1m')[0].scored).toBe(1)})
it('clamps calendar month boundaries',()=>{expect(trackRecordStart('2026-03-31','1m')).toBe('2026-02-28');expect(trackRecordStart('2024-03-31','1m')).toBe('2024-02-29');expect(trackRecordStart(today,'all')).toBe('')})
