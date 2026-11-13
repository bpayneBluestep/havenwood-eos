import {describe,it,expect} from 'vitest'
import {defaultLiveSections,changeLiveSection,liveSectionMs,validateLiveRating,uniqueLiveParticipants} from './liveSessionModel'
import type {LiveSession} from './liveSessionModel'
const session=():LiveSession=>({id:'s',title:'Example meeting',companyId:'team',meetingId:'',date:'2026-11-12',hostId:'host',hostName:'Host',status:'running',activeIndex:0,activeStartedAt:1000,startedAt:1000,endedAt:null,sections:defaultLiveSections(),rev:1})
describe('live meeting timer',()=>{
 it('accumulates time separately for each section',()=>{const next=changeLiveSection(session(),'host','next',4000);expect(next.sections[0].spentMs).toBe(3000);expect(liveSectionMs(next,1,6500)).toBe(2500);expect(liveSectionMs(next,0,6500)).toBe(3000)})
 it('retains cumulative time when a facilitator returns to an earlier section',()=>{const next=changeLiveSection(session(),'host','next',4000);const back=changeLiveSection(next,'host','select',7000,0);expect(liveSectionMs(back,0,9000)).toBe(5000);expect(back.sections[1].spentMs).toBe(3000)})
 it('excludes paused time',()=>{const paused=changeLiveSection(session(),'host','pause',4000);expect(liveSectionMs(paused,0,9000)).toBe(3000);const resumed=changeLiveSection(paused,'host','resume',10000);expect(liveSectionMs(resumed,0,11000)).toBe(4000)})
 it('persists final totals and refuses further timer changes',()=>{const ended=changeLiveSection(session(),'host','end',6000);expect(ended.endedAt).toBe(6000);expect(liveSectionMs(ended,0,10000)).toBe(5000);expect(()=>changeLiveSection(ended,'host','next',11000)).toThrow('ended')})
 it('does not let a participant control the facilitator timer',()=>{expect(()=>changeLiveSection(session(),'attendee','end',5000)).toThrow('Only the facilitator')})
 it('rejects unknown sections and commands without mutating the session',()=>{const original=session();expect(()=>changeLiveSection(original,'host','select',5000,100)).toThrow();expect(()=>changeLiveSection(original,'host','bad',5000)).toThrow();expect(original.sections[0].spentMs).toBe(0)})
})
describe('joined participants and ratings',()=>{
 it('records the host and independent joins without duplicate people',()=>{const rows=[{userId:'second',name:'Second',joinedAt:2000,rating:null,updatedAt:2000},{userId:'third',name:'Third',joinedAt:3000,rating:null,updatedAt:3000}];expect(uniqueLiveParticipants(session(),rows).map(person=>person.userId)).toEqual(['host','second','third'])})
 it('keeps the latest personal rating and other participants',()=>{const rows=[{userId:'second',name:'Second',joinedAt:2000,rating:7,updatedAt:5000},{userId:'third',name:'Third',joinedAt:3000,rating:9,updatedAt:6000},{userId:'second',name:'Second',joinedAt:2000,rating:8,updatedAt:7000}];const people=uniqueLiveParticipants(session(),rows);expect(people).toHaveLength(3);expect(people.find(person=>person.userId==='second')?.rating).toBe(8);expect(people.find(person=>person.userId==='third')?.rating).toBe(9)})
 it('opens ratings at Conclude and after End',()=>{const ready={...session(),activeIndex:6};const people=uniqueLiveParticipants(ready,[]);expect(validateLiveRating(ready,'host',people,10)).toBe(10);expect(validateLiveRating({...ready,status:'ended'},'host',people,1)).toBe(1)})
 it('rejects nonparticipants and early ratings',()=>{const current=session(),people=uniqueLiveParticipants(current,[]);expect(()=>validateLiveRating({...current,status:'ended'},'outsider',people,8)).toThrow('Join');expect(()=>validateLiveRating(current,'host',people,8)).toThrow('Conclude')})
 it.each([0,11,1.5,'8',null])('rejects invalid rating %s',rating=>{const ended={...session(),status:'ended' as const};expect(()=>validateLiveRating(ended,'host',uniqueLiveParticipants(ended,[]),rating)).toThrow('1 to 10')})
})
