export const MODULE_KINDS = ['tenk_plan','tenk_priority','tenk_seat','tenk_seat_template','tenk_assignment','tenk_visibility','tenk_history','tenk_import_batch'] as const;
export type ModuleKind = typeof MODULE_KINDS[number];
export type ModuleName = 'vision'|'accountability';
export interface ModuleEntity {readOnly?:boolean;schemaVersion:number;id:string;kind:ModuleKind;companyId:string;rev:number;createdAt:string;updatedAt:string;editorId:string;archived:boolean;data:Record<string,unknown>}
export interface ModuleVisibility {vision:string[];accountability:string[]}
export interface ScopeTeam {id:string;companyId:string;memberIds:string[];archived?:boolean}
export function validModuleId(value:unknown):value is string {return typeof value==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(value)&&['__proto__','constructor','prototype','toString','toLocaleString','valueOf','hasOwnProperty','isPrototypeOf','propertyIsEnumerable','__defineGetter__','__defineSetter__','__lookupGetter__','__lookupSetter__'].indexOf(value)<0;}
export function isInternalTeamKind(kind:string):boolean {return kind==='member_profile'||kind.indexOf('tenk_')===0;}
export function moduleKind(value:unknown):ModuleKind {if(typeof value!=='string'||(MODULE_KINDS as readonly string[]).indexOf(value)<0)throw Error('Invalid module kind.');return value as ModuleKind;}
export function moduleForKind(kind:ModuleKind):ModuleName|null {return kind==='tenk_plan'||kind==='tenk_priority'?'vision':kind==='tenk_seat'||kind==='tenk_seat_template'||kind==='tenk_assignment'?'accountability':null;}
export function validateVisibility(input:unknown,companyId:string,teams:ScopeTeam[]):ModuleVisibility {
 if(!validModuleId(companyId)||!input||typeof input!=='object')throw Error('Invalid company visibility.');
 const out:ModuleVisibility={vision:[],accountability:[]};
 for(const key of ['vision','accountability'] as ModuleName[]){const ids=(input as ModuleVisibility)[key];if(!Array.isArray(ids)||ids.length>500)throw Error('Select visibility teams.');for(const id of ids){if(!validModuleId(id)||!teams.some(t=>t.id===id&&t.companyId===companyId&&!t.archived))throw Error('Invalid visibility team.');if(out[key].indexOf(id)<0)out[key].push(id);}out[key].sort();}
 return out;
}
export function canReadModule(actorId:string,companyId:string,module:ModuleName,visibility:ModuleVisibility|undefined,teams:ScopeTeam[]):boolean {return !!visibility&&teams.some(t=>!t.archived&&t.companyId===companyId&&visibility[module].indexOf(t.id)>=0&&t.memberIds.indexOf(actorId)>=0);}
export function requireModuleAccess(actorId:string,isAdmin:boolean,companyId:string,module:ModuleName,visibility:ModuleVisibility|undefined,teams:ScopeTeam[],edit=false):void {if(!canReadModule(actorId,companyId,module,visibility,teams)||(edit&&!isAdmin))throw Error('Module access denied.');}
export function saveModuleEntity(current:ModuleEntity|undefined,input:{id:string;kind:ModuleKind;companyId:string;data:Record<string,unknown>;archived?:boolean},expectedRev:unknown,actorId:string,at:string):ModuleEntity {
 moduleKind(input.kind);if(!validModuleId(input.id)||!validModuleId(input.companyId)||!validModuleId(actorId))throw Error('Invalid module identity.');
 if(current&&(current.id!==input.id||current.kind!==input.kind||current.companyId!==input.companyId))throw Error('Module scope cannot change.');
 if(!Number.isInteger(expectedRev)||expectedRev!==(current?current.rev:0))throw Error('Reload before saving. This record changed.');
 if(!input.data||Array.isArray(input.data)||typeof input.data!=='object'||JSON.stringify(input.data).length>180000)throw Error('Invalid module data.');
 const data=JSON.parse(JSON.stringify(input.data));
 return {schemaVersion:1,id:input.id,kind:input.kind,companyId:input.companyId,rev:(current?current.rev:0)+1,createdAt:current?current.createdAt:at,updatedAt:at,editorId:actorId,archived:!!input.archived,data};
}
export function restoreModuleEntity(current:ModuleEntity,snapshot:ModuleEntity,expectedRev:unknown,actorId:string,at:string):ModuleEntity {return saveModuleEntity(current,{id:snapshot.id,kind:snapshot.kind,companyId:snapshot.companyId,data:snapshot.data,archived:snapshot.archived},expectedRev,actorId,at);}
export interface CanonicalReference {kind:'rock'|'issue'|'measurable';id:string;teamId:string}
export function authorizeCanonicalReference(ref:CanonicalReference,accessibleTeamIds:string[],recordIsVisible:(ref:CanonicalReference)=>boolean):boolean {return !!ref&&['rock','issue','measurable'].indexOf(ref.kind)>=0&&validModuleId(ref.id)&&validModuleId(ref.teamId)&&accessibleTeamIds.indexOf(ref.teamId)>=0&&recordIsVisible(ref);}
