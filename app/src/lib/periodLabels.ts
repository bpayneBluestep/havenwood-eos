/** Sunday immediately before the ISO week starts. Stored period keys stay unchanged. */
export function weekSundayLabel(key:string):string {
 const match=/^(\d{4})-W(\d{1,2})$/.exec(key)
 if(!match)return ''
 const year=Number(match[1]),week=Number(match[2]);if(week<1||week>53)return ''
 const monday=new Date(Date.UTC(year,0,4));monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7)+(week-1)*7)
 const thursday=new Date(monday);thursday.setUTCDate(thursday.getUTCDate()+3);if(thursday.getUTCFullYear()!==year)return ''
 monday.setUTCDate(monday.getUTCDate()-1)
 return monday.toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'})
}
