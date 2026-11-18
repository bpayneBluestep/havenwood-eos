export const richNotesPrefix='tenk-rich-notes-v1:'
export type NotesNode=string|{tag:string;children:NotesNode[]}
export const notesTags=['div','p','br','strong','em','ul','ol','li']
export function readNotesDocument(text:string):NotesNode[]|null {
 if(!text.startsWith(richNotesPrefix))return null
 try {const parsed:unknown=JSON.parse(text.slice(richNotesPrefix.length));let count=0
  function valid(value:unknown,depth:number):value is NotesNode {if(++count>10000||depth>20)return false;if(typeof value==='string')return true;if(!value||typeof value!=='object')return false;const node=value as {tag?:unknown;children?:unknown};return typeof node.tag==='string'&&notesTags.includes(node.tag)&&Array.isArray(node.children)&&node.children.every(child=>valid(child,depth+1))}
  return Array.isArray(parsed)&&parsed.every(node=>valid(node,0))?parsed:null
 }catch{return null}
}
