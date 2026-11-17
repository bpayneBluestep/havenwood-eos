import type {MouseEvent,KeyboardEvent} from 'react'
const controls='button,a,input,select,textarea,label,summary,form,[role="button"],[role="dialog"],[contenteditable="true"],[data-row-control]'
export function rowEditor(open:()=>void,disabled=false){
 if(disabled)return {}
 return {tabIndex:0,onClick:(event:MouseEvent<HTMLElement>)=>{if(!(event.target as Element).closest(controls))open()},onKeyDown:(event:KeyboardEvent<HTMLElement>)=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();open()}}}
}
