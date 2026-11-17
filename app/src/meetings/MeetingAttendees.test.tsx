// @vitest-environment jsdom
import {render,screen,within,cleanup} from '@testing-library/react'
import {afterEach,it,expect} from 'vitest'
import MeetingAttendees,{attendeeConnection} from './MeetingAttendees'
afterEach(cleanup)
it('shows the whole roster and separates connected, previous and absent participants',()=>{const session={status:'running',participants:[{userId:'a',name:'Member A',lastSeenAt:95000},{userId:'b',name:'Member B',lastSeenAt:1000}]} as any;render(<MeetingAttendees session={session} roster={[{id:'a',name:'Member A'},{id:'b',name:'Member B'},{id:'c',name:'Member C'}]} now={100000}/>);const roster=within(screen.getByRole('list',{name:'Team meeting roster'}));expect(roster.getAllByRole('listitem')).toHaveLength(3);expect(roster.getByText('Connected')).toBeTruthy();expect(roster.getByText('Joined earlier')).toBeTruthy();expect(roster.getByText('Not joined')).toBeTruthy();expect(screen.getByText('1/3')).toBeTruthy()})
it('expires the indicator and does not mark unknown or ended connections as current',()=>{expect(attendeeConnection(40000,100000,false)).toBe(true);expect(attendeeConnection(39999,100000,false)).toBe(false);expect(attendeeConnection(undefined,100000,false)).toBe(false);expect(attendeeConnection(100000,100000,true)).toBe(false);expect(attendeeConnection(200000,100000,false)).toBe(false)})
