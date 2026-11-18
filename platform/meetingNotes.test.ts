import {describe,it,expect} from 'vitest'
import {noteHeads,validateNoteWrite} from './meetingNotes'
import type {NoteRevision} from './meetingNotes'
const session={status:'running',sections:[{id:'segue'},{id:'issues'}]}
const revision=(id:string,parents:string[]=[],text=id):NoteRevision=>({id,parents,text,sectionId:'segue',authorId:'person',authorName:'Person',at:1})
describe('shared meeting notes',()=>{
 it('retains simultaneous revisions until an explicit merge',()=>{const rows=[revision('a'),revision('b',['a']),revision('c',['a'])];expect(noteHeads(rows,'segue').map(row=>row.id)).toEqual(['b','c']);expect(()=>validateNoteWrite(session,true,'segue','merge',['b'],rows)).toThrow('Notes changed');const write=validateNoteWrite(session,true,'segue','merge',['b','c'],rows);rows.push(revision('d',write.parents,write.text));expect(noteHeads(rows,'segue').map(row=>row.id)).toEqual(['d']);expect(rows).toHaveLength(4)})
 it('rejects unjoined, ended, invalid and oversized writes',()=>{expect(()=>validateNoteWrite(session,false,'segue','text',[],[])).toThrow('Join');expect(()=>validateNoteWrite({...session,status:'ended'},true,'segue','text',[],[])).toThrow('read-only');expect(()=>validateNoteWrite(session,true,'foreign','text',[],[])).toThrow('agenda');expect(()=>validateNoteWrite(session,true,'segue','x'.repeat(20001),[],[])).toThrow('20,000');expect(()=>validateNoteWrite(session,true,'segue','text',['a','a'],[])).toThrow('versions')})
 it('keeps independent sections and requires the current revision',()=>{const rows=[revision('a')];expect(validateNoteWrite(session,true,'issues','other',[],rows).parents).toEqual([]);expect(()=>validateNoteWrite(session,true,'segue','old',[],rows)).toThrow('changed');expect(validateNoteWrite(session,true,'segue','new',['a'],rows).text).toBe('new')})
})
