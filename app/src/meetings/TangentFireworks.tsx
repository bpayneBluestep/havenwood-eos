import {useEffect,useState} from 'react'
import type {CSSProperties} from 'react'
import {createPortal} from 'react-dom'

const bursts=[{x:18,y:25},{x:78,y:22},{x:48,y:40},{x:25,y:70},{x:82,y:68},{x:50,y:78},{x:50,y:15}]
const colors=['#ff657a','#ffcc66','#9d8aff','#64d8ff','#ff96d5']
export default function TangentFireworks() {
 const [visible,setVisible]=useState(true)
 useEffect(()=>{const timer=window.setTimeout(()=>setVisible(false),3500);return()=>window.clearTimeout(timer)},[])
 if(!visible)return null
 return createPortal(<div className="tangent-fireworks" data-testid="tangent-fireworks" aria-hidden="true">{bursts.map((burst,index)=><div className="tangent-fireworks__burst" key={index} style={{left:`${burst.x}%`,top:`${burst.y}%`}}>{Array.from({length:48},(_,particle)=>{
  const angle=particle*Math.PI/24,distance=240+(particle%4)*55
  return <i className="tangent-fireworks__spark" key={particle} style={{'--dx':`${Math.cos(angle)*distance}px`,'--dy':`${Math.sin(angle)*distance}px`,'--fall':`${Math.sin(angle)*distance+100}px`,background:colors[(index+particle)%colors.length],animationDelay:`${index*.18}s`} as CSSProperties}/>
 })}</div>)}</div>,document.body)
}
