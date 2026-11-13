export interface LayoutSeat {id:string;data:{parentSeatId:string;displayOrder?:number;title:string}}
export interface ChartNode {id:string;parentId:string;x:number;y:number;depth:number}
export interface ChartLayout {nodes:ChartNode[];width:number;height:number}
export const CHART_CARD_WIDTH=246,CHART_CARD_HEIGHT=152,CHART_GAP_X=28,CHART_GAP_Y=44;
export function seatDescendants(seats:LayoutSeat[],id:string):Set<string>{const found=new Set<string>(),queue=[id];while(queue.length){const parent=queue.pop()!;for(const seat of seats)if(seat.data.parentSeatId===parent&&!found.has(seat.id)&&seat.id!==id){found.add(seat.id);queue.push(seat.id)}}return found;}
export function chartAncestors(seats:LayoutSeat[],ids:string[]):Set<string>{const byId=new Map(seats.map(s=>[s.id,s])),found=new Set<string>();for(const id of ids){let node=byId.get(id);const path=new Set<string>();while(node?.data.parentSeatId&&!path.has(node.id)){path.add(node.id);found.add(node.data.parentSeatId);node=byId.get(node.data.parentSeatId)}}return found;}
export function layoutAccountability(seats:LayoutSeat[],collapsed:Record<string,boolean>={},focus=''):ChartLayout{
 const byId=new Map(seats.map(s=>[s.id,s])),children=new Map<string,LayoutSeat[]>();
 for(const seat of seats){const parent=byId.has(seat.data.parentSeatId)?seat.data.parentSeatId:'';const siblings=children.get(parent)||[];siblings.push(seat);children.set(parent,siblings)}
 for(const siblings of children.values())siblings.sort((a,b)=>(a.data.displayOrder||0)-(b.data.displayOrder||0)||a.data.title.localeCompare(b.data.title)||a.id.localeCompare(b.id));
 const roots=focus&&byId.has(focus)?[byId.get(focus)!]:(children.get('')||[]).slice(),visited=new Set<string>(),ordered:{seat:LayoutSeat;depth:number;parentId:string}[]=[];
 const visit=(root:LayoutSeat)=>{const stack=[{seat:root,depth:0,parentId:''}];while(stack.length){const item=stack.pop()!;if(visited.has(item.seat.id))continue;visited.add(item.seat.id);ordered.push(item);if(!collapsed[item.seat.id]){const list=children.get(item.seat.id)||[];for(let i=list.length-1;i>=0;i--)stack.push({seat:list[i],depth:item.depth+1,parentId:item.seat.id})}}};
 for(const root of roots)visit(root);
 // Corrupt legacy cycles remain visible and bounded. Server validation owns repair.
 if(!focus)for(const seat of seats)if(!visited.has(seat.id)&&!chartAncestors(seats,[seat.id]).size)visit(seat);
 if(!focus&&ordered.length===0&&seats.length)visit(seats[0]);
 const visibleChildren=new Map<string,string[]>();for(const item of ordered){const list=visibleChildren.get(item.parentId)||[];list.push(item.seat.id);visibleChildren.set(item.parentId,list)}
 const widths=new Map<string,number>();for(let i=ordered.length-1;i>=0;i--){const item=ordered[i],list=visibleChildren.get(item.seat.id)||[];widths.set(item.seat.id,Math.max(CHART_CARD_WIDTH,list.reduce((sum,id)=>sum+(widths.get(id)||CHART_CARD_WIDTH),0)+Math.max(0,list.length-1)*CHART_GAP_X))}
 const starts=new Map<string,number>();let rootX=16;for(const id of visibleChildren.get('')||[]){starts.set(id,rootX);rootX+=(widths.get(id)||CHART_CARD_WIDTH)+CHART_GAP_X}
 const nodes:ChartNode[]=[];for(const item of ordered){const start=starts.get(item.seat.id)||16,width=widths.get(item.seat.id)||CHART_CARD_WIDTH;nodes.push({id:item.seat.id,parentId:item.parentId,x:start+(width-CHART_CARD_WIDTH)/2,y:16+item.depth*(CHART_CARD_HEIGHT+CHART_GAP_Y),depth:item.depth});let x=start;for(const child of visibleChildren.get(item.seat.id)||[]){starts.set(child,x);x+=(widths.get(child)||CHART_CARD_WIDTH)+CHART_GAP_X}}
 return {nodes,width:Math.max(300,rootX-CHART_GAP_X+16),height:Math.max(200,...nodes.map(n=>n.y+CHART_CARD_HEIGHT+16))};
}
