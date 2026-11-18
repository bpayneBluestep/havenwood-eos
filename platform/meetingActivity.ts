export interface MeetingActivity {id:string;at:number;actorId:string;actorName:string;sectionIds:string[];action:string;itemId:string;title:string;ownerName:string;dueDate:string;target:string;description:string;status:string;source:string}
export interface MeetingEmailHistory {id:string;requestId:string;recipient:string;byId:string;byName:string;at:number;status:'preparing'|'queued'|'uncertain'|'submitted'|'sent'|'failed';detail?:string}
export function activitySectionIds(sections:{id:string;kind?:string}[],kinds:string[]):string[]{return sections.filter(section=>kinds.includes(section.kind||section.id)).map(section=>section.id)}
export function activityAllowed(session:{companyId:string;meetingId?:string;date:string},companyId:string,item:{personal?:boolean;meetingId?:string;occurrenceDate?:string;assignedTeamIds?:string[]}):boolean {
 if(item.personal)return false
 if(item.meetingId)return !!session.meetingId&&item.meetingId===session.meetingId&&item.occurrenceDate===session.date&&companyId===session.companyId
 return companyId===session.companyId||!!item.assignedTeamIds?.includes(session.companyId)
}
export function recipientAddress(value:unknown):string {if(typeof value!=='string')throw Error('Enter one email address.');const email=value.trim();if(email.length>254||!/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(email))throw Error('Enter one valid email address.');return email}
export function emailRequestId(value:unknown):string {if(typeof value!=='string'||!/^send_[a-zA-Z0-9_-]{12,90}$/.test(value))throw Error('Reload the send form and try again.');return value}
export function notesPlainText(text:string):string {
 if(!text.startsWith('tenk-rich-notes-v1:'))return text
 try {const root=JSON.parse(text.slice('tenk-rich-notes-v1:'.length));let count=0
  function visit(node:any,depth:number):string {if(++count>10000||depth>20)return '';if(typeof node==='string')return node;if(!node||!Array.isArray(node.children))return '';const children=node.children.map((child:any)=>visit(child,depth+1));if(node.tag==='ul'||node.tag==='ol')return '\n'+children.map((child:string,index:number)=>(node.tag==='ul'?'- ':`${index+1}. `)+child.trim()).join('\n')+'\n';return children.join('')+(['div','p','br','li'].includes(node.tag)?'\n':'')}
  return Array.isArray(root)?root.map(node=>visit(node,0)).join('').trim():''
 }catch{return text}
}
export function activityLines(event:MeetingActivity):string[] {
 const lines=[`${event.action}: ${event.title}`,`By: ${event.actorName}`,`Responsible: ${event.ownerName||'Unassigned'}`]
 if(event.dueDate)lines.push('Due: '+event.dueDate)
 if(event.target)lines.push('Target: '+event.target)
 if(event.status)lines.push('Status: '+event.status)
 if(event.source)lines.push('Source: '+event.source)
 if(event.description)lines.push(event.description)
 return lines
}
export function meetingEmailText(session:{title:string;date:string;sections:{id:string;label:string}[]},notes:{sectionId:string;versions:{text:string;authorName:string}[]}[],events:MeetingActivity[]):string {
 const lines=[session.title,'Meeting date: '+session.date,'','Saved meeting notes and recorded activity.','Activity tracking begins when enabled; earlier actions are not reconstructed.','']
 for(const section of session.sections){lines.push(section.label,'-'.repeat(Math.min(60,section.label.length)));const versions=notes.find(note=>note.sectionId===section.id)?.versions||[];if(versions.length>1)lines.push('Unmerged note versions:');for(const note of versions)if(note.text)lines.push((versions.length>1?note.authorName+':\n':'')+notesPlainText(note.text));for(const event of events.filter(item=>item.sectionIds.includes(section.id)))lines.push(...activityLines(event).map(line=>'- '+line),'');lines.push('')}
 const unmatched=events.filter(event=>!event.sectionIds.length);if(unmatched.length){lines.push('Additional meeting activity');for(const event of unmatched)lines.push(...activityLines(event).map(line=>'- '+line),'')}
 return lines.join('\n')
}
