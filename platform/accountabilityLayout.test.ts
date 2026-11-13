import {describe,it,expect} from 'vitest'
import {layoutAccountability,chartAncestors,seatDescendants,CHART_CARD_WIDTH} from './accountabilityLayout'
const seat=(id:string,parentSeatId='')=>({id,data:{parentSeatId,title:id,displayOrder:0}})
describe('accountability chart layout',()=>{
 it('places children under their parent with no sibling overlap',()=>{const result=layoutAccountability([seat('a'),seat('b','a'),seat('c','a')]);const [a,b,c]=result.nodes;expect(b.y).toBeGreaterThan(a.y);expect(c.x-b.x).toBeGreaterThan(CHART_CARD_WIDTH);expect(a.x).toBe((b.x+c.x)/2);expect(b.parentId).toBe('a')})
 it('collapses branches and focuses one branch',()=>{const rows=[seat('a'),seat('b','a'),seat('c','b'),seat('d')];expect(layoutAccountability(rows,{b:true}).nodes.map(n=>n.id)).toEqual(['a','b','d']);expect(layoutAccountability(rows,{},'b').nodes.map(n=>n.id)).toEqual(['b','c'])})
 it('finds ancestors and descendants without looping on cycles',()=>{const rows=[seat('a'),seat('b','a'),seat('c','b')];expect([...chartAncestors(rows,['c'])]).toEqual(['b','a']);expect([...seatDescendants(rows,'a')]).toEqual(['b','c']);expect(layoutAccountability([seat('x','y'),seat('y','x')]).nodes).toHaveLength(2)})
 it('handles long titles and deep or wide branches deterministically',()=>{const deep=Array.from({length:250},(_,i)=>seat('s'+i,i?'s'+(i-1):''));expect(layoutAccountability(deep).nodes).toHaveLength(250);const wide=[seat('root'),...Array.from({length:60},(_,i)=>seat('child'+i,'root'))];const result=layoutAccountability(wide);expect(result.width).toBeGreaterThan(60*CHART_CARD_WIDTH);expect(layoutAccountability(wide)).toEqual(result)})
})
