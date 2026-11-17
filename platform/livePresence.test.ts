import {it,expect} from 'vitest'
import {validateLivePresence} from './liveSessionModel'
it('limits connection checks to joined users in active meetings',()=>{const session={status:'running'} as any,people=[{userId:'member'}] as any;expect(()=>validateLivePresence(session,'member',people)).not.toThrow();expect(()=>validateLivePresence({...session,status:'paused'},'member',people)).not.toThrow();expect(()=>validateLivePresence(session,'outsider',people)).toThrow();expect(()=>validateLivePresence({...session,status:'ended'},'member',people)).toThrow()})
