import {useEffect,useRef} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {NotesPreview} from './NotesText'
import {richNotesPrefix,notesTags} from './notesDocument'
import type {NotesNode} from './notesDocument'

/** Save a small, allowlisted document tree, never browser HTML or Markdown markers. */
export function notesFromEditor(root:HTMLElement):string {
 function nodes(parent:Node,depth=0):NotesNode[] {
  if(depth>20)return [parent.textContent||'']
  return Array.from(parent.childNodes).flatMap((node):NotesNode[]=>{
   if(node.nodeType===3)return [(node.textContent||'').replace(/\u00a0/g,' ')]
   if(node.nodeType!==1)return []
   const element=node as HTMLElement,original=element.tagName.toLowerCase()
   if(['script','style','iframe','object','img'].includes(original))return []
   const tag=original==='b'?'strong':original==='i'?'em':original,children=nodes(element,depth+1)
   return notesTags.includes(tag)?[{tag,children}]:children
  })
 }
 if(!root.textContent?.trim()&&!root.querySelector('li'))return ''
 return richNotesPrefix+JSON.stringify(nodes(root))
}
export default function RichNotesEditor({label,text,onChange}:{label:string;text:string;onChange:(text:string)=>void}) {
 const editor=useRef<HTMLDivElement>(null),rendered=useRef<string|null>(null)
 useEffect(()=>{if(editor.current&&rendered.current!==text){editor.current.innerHTML=renderToStaticMarkup(<NotesPreview text={text}/>);rendered.current=text}},[text])
 function changed(){if(!editor.current)return;const value=notesFromEditor(editor.current);rendered.current=value;onChange(value)}
 function format(command:string){editor.current?.focus();document.execCommand('styleWithCSS',false,'false');document.execCommand(command,false);changed()}
 return <><div className="meeting-notes__tools" role="group" aria-label={`Format ${label} notes`}>
 <button type="button" className="btn btn--sm" aria-label="Bold" onMouseDown={event=>event.preventDefault()} onClick={()=>format('bold')}><strong>B</strong></button>
 <button type="button" className="btn btn--sm" aria-label="Italic" onMouseDown={event=>event.preventDefault()} onClick={()=>format('italic')}><em>I</em></button>
 <button type="button" className="btn btn--sm" onMouseDown={event=>event.preventDefault()} onClick={()=>format('insertUnorderedList')}>• List</button>
 <button type="button" className="btn btn--sm" onMouseDown={event=>event.preventDefault()} onClick={()=>format('insertOrderedList')}>1. List</button>
 </div><div ref={editor} className="input meeting-notes__editor" role="textbox" aria-label={`${label} notes text`} aria-multiline="true" contentEditable suppressContentEditableWarning onInput={changed} onPaste={event=>{event.preventDefault();const text=event.clipboardData.getData('text/plain');document.execCommand('insertText',false,text);changed()}}/></>
}
