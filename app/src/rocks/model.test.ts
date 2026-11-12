import {describe,it,expect} from 'vitest'
import {groupRocks,milestoneStatus} from './model'
import type {Rock,Milestone} from '../api'
describe('owner segments and milestone migration',()=>{
 it('groups by identity, keeps empty team members and separates unassigned',()=>{const rows=[{id:'r1',ownerId:'a'},{id:'r2',ownerId:'a'},{id:'r3',ownerId:'',ownerName:''},{id:'r4',ownerId:'other',ownerName:'External owner'}] as Rock[];const groups=groupRocks(rows,[{id:'a',name:'Alex'},{id:'b',name:'Blair'}]);expect(groups.find(group=>group.id==='a')?.rocks.map(rock=>rock.id)).toEqual(['r1','r2']);expect(groups.find(group=>group.id==='b')?.rocks).toEqual([]);expect(groups.at(-1)?.name).toBe('Unassigned');expect(groups.find(group=>group.id==='other')?.rocks[0].id).toBe('r4')})
 it('maps old done flags without rewriting data',()=>{expect(milestoneStatus({done:true} as Milestone)).toBe('complete');expect(milestoneStatus({done:false} as Milestone)).toBe('not_started')})
 it('keeps blocked and in-progress distinct, with completion authoritative',()=>{expect(milestoneStatus({done:false,status:'blocked'} as Milestone)).toBe('blocked');expect(milestoneStatus({done:false,status:'in_progress'} as Milestone)).toBe('in_progress');expect(milestoneStatus({done:true,status:'blocked'} as Milestone)).toBe('complete')})
})
