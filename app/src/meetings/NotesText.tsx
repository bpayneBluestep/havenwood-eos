import {createElement,Fragment} from 'react'
import {readNotesDocument} from './notesDocument'
import type {NotesNode} from './notesDocument'
function Inline({text}:{text:string}) {
 return <>{text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).map((part,index)=>part.startsWith('**')&&part.endsWith('**')?<strong key={index}>{part.slice(2,-2)}</strong>:part.startsWith('*')&&part.endsWith('*')?<em key={index}>{part.slice(1,-1)}</em>:<Fragment key={index}>{part}</Fragment>)}</>
}
export function NotesPreview({text}:{text:string}) {
 const rich=readNotesDocument(text)
 function renderNode(node:NotesNode,index:number):React.ReactNode{return typeof node==='string'?node:createElement(node.tag,{key:index},...(node.tag==='br'?[]:node.children.map(renderNode)))}
 if(rich)return <div className="meeting-notes__preview">{rich.map(renderNode)}</div>
 const lines=text.split('\n'),blocks:React.ReactNode[]=[]
 for(let i=0;i<lines.length;){const line=lines[i],bullet=/^\s*[-*] /.test(line),number=/^\s*\d+\. /.test(line)
  if(bullet||number){const items:React.ReactNode[]=[];const pattern=bullet?/^\s*[-*] /:/^\s*\d+\. /;const start=i;while(i<lines.length&&pattern.test(lines[i])){items.push(<li key={i}><Inline text={lines[i].replace(pattern,'')}/></li>);i++}blocks.push(bullet?<ul key={start}>{items}</ul>:<ol key={start}>{items}</ol>)}
  else {blocks.push(<p key={i}><Inline text={line||'\u00a0'}/></p>);i++}
 }
 return <div className="meeting-notes__preview">{blocks}</div>
}
