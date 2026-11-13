import {useEffect,useState} from 'react'
import type {CSSProperties} from 'react'
import {createPortal} from 'react-dom'

const bursts=[{x:20,y:30},{x:75,y:25},{x:48,y:45},{x:30,y:65},{x:82,y:62}]
const colors=['#ff657a','#ffcc66','#9d8aff','#64d8ff','#ff96d5']
export default function TangentFireworks() {
 const [visible,setVisible]=useState(true)
 useEffect(()=>{const timer=window.setTimeout(()=>setVisible(false),3500);return()=>window.clearTimeout(timer)},[])
 if(!visible)return null
 return createPortal(<div className="tangent-fireworks" data-testid="tangent-fireworks" aria-hidden="true">{bursts.map((burst,index)=><div className="tangent-fireworks__burst" key={index} style={{left:`${burst.x}%`,top:`${burst.y}%`}}>{Array.from({length:24},(_,particle)=>{
  const angle=particle*Math.PI/12,distance=90+(particle%3)*28
  return <i className="tangent-fireworks__spark" key={particle} style={{'--dx':`${Math.cos(angle)*distance}px`,'--dy':`${Math.sin(angle)*distance}px`,'--fall':`${Math.sin(angle)*distance+55}px`,background:colors[(index+particle)%colors.length],animationDelay:`${index*.28}s`} as CSSProperties}/>
 })}</div>)}</div>,document.body)
}
