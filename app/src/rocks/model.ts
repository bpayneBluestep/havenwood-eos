import type {Milestone,Rock,PersonRef} from '../api'
export const milestoneColumns = [{id:'not_started',label:'Not started'},{id:'in_progress',label:'In progress'},{id:'blocked',label:'Blocked'},{id:'complete',label:'Complete'}] as const
export type MilestoneStatus = typeof milestoneColumns[number]['id']
export function milestoneStatus(item:Milestone):MilestoneStatus {
 if(item.done)return 'complete'
 return item.status==='in_progress'||item.status==='blocked'?item.status:'not_started'
}
export function groupRocks(rows:Rock[],people:PersonRef[]){
 const groups=new Map(people.map(person=>[person.id,{id:person.id,name:person.name,rocks:[] as Rock[]}]))
 for(const rock of rows){const id=rock.ownerId||'';if(!groups.has(id))groups.set(id,{id,name:rock.ownerName||(id?'Team member':'Unassigned'),rocks:[]});groups.get(id)!.rocks.push(rock)}
 return [...groups.values()].sort((a,b)=>a.id===''?1:b.id===''?-1:a.name.localeCompare(b.name))
}
