export interface NoteRevision {id:string;sectionId:string;parents:string[];text:string;authorId:string;authorName:string;at:number}
export interface SectionNotes {sectionId:string;versions:NoteRevision[]}
export interface MeetingNotesView {sections:SectionNotes[];canEdit:boolean;activities?:import('./meetingActivity').MeetingActivity[];emailHistory?:import('./meetingActivity').MeetingEmailHistory[]}
export function noteHeads(rows:NoteRevision[],sectionId:string):NoteRevision[] {
 const section=rows.filter(row=>row.sectionId===sectionId),parents=new Set<string>()
 for(const row of section)for(const parent of row.parents)parents.add(parent)
 return section.filter(row=>!parents.has(row.id)).sort((a,b)=>a.at-b.at || a.id.localeCompare(b.id))
}
export function validateNoteWrite(session:{status:string;sections:{id:string}[]},joined:boolean,sectionId:unknown,text:unknown,parents:unknown,current:NoteRevision[]):{sectionId:string;text:string;parents:string[]} {
 if(!joined)throw Error('Join this meeting before editing notes.')
 if(session.status==='ended')throw Error('This meeting has ended. Notes are read-only.')
 if(typeof sectionId!=='string'||!session.sections.some(section=>section.id===sectionId))throw Error('Choose a section from this meeting agenda.')
 if(typeof text!=='string'||text.length>20000)throw Error('Keep each section within 20,000 characters.')
 if(!Array.isArray(parents)||parents.some(id=>typeof id!=='string')||parents.length>100||new Set(parents).size!==parents.length)throw Error('Reload the current note versions.')
 const heads=noteHeads(current,sectionId).map(row=>row.id).sort(),sent=[...parents].sort()
 if(heads.length!==sent.length||heads.some((id,index)=>id!==sent[index]))throw Error('Notes changed. Review the current versions before saving.')
 return {sectionId,text,parents:sent}
}
