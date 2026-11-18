import {it,expect,vi} from 'vitest'
import {commitWithMeetingCache} from './meetingCache'

it('keeps a newly saved meeting visible to the next poll when record and report lists were cached',()=>{
 const stored=new Map([['old',{status:'ended'}]])
 let recordIds=['old'],reportIds=['old']
 const record={forms:{eosMeetings:{formRecord:()=>({id:()=> 'record-form'})}},reset:()=>{recordIds=[...stored.keys()]}}
 const evict=(key:string)=>{if(key==='report')reportIds=[...stored.keys()];if(key==='record-form')recordIds=[...stored.keys()]}
 commitWithMeetingCache(()=>stored.set('new',{status:'running'}),[record],evict,'report')
 const poll=()=>reportIds.filter(id=>recordIds.includes(id)).map(id=>({id,...stored.get(id)!}))
 expect(poll().find(row=>row.id==='new')?.status).toBe('running')
 expect(poll().find(row=>row.id==='old')?.status).toBe('ended')
 expect(poll().find(row=>row.id==='new')?.status).toBe('running')
})
it('does not invalidate reads or reset records when the save is rejected',()=>{
 const evict=vi.fn(),reset=vi.fn(),record={forms:{eosMeetings:{formRecord:()=>({id:()=> 'record-form'})}},reset}
 expect(()=>commitWithMeetingCache(()=>{throw Error('Rejected')},[record],evict,'report')).toThrow('Rejected')
 expect(evict).not.toHaveBeenCalled();expect(reset).not.toHaveBeenCalled()
})
it('expires only affected meeting lists after the save and leaves ordinary updates alone',()=>{
 const events:string[]=[],record={forms:{eosMeetings:{formRecord:()=>({id:()=> 'record-form'})}},reset:()=>events.push('reset')}
 commitWithMeetingCache(()=>{events.push('save')},[record],key=>{events.push(key)},'report')
 expect(events).toEqual(['save','record-form','report','reset'])
 const evict=vi.fn();commitWithMeetingCache(()=>{},[],evict,'report');expect(evict).not.toHaveBeenCalled()
})
