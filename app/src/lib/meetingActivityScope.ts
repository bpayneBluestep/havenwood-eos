export interface ActivityScope {companyId:string;sessionId:string}
let current:{scope:ActivityScope;token:symbol}|null=null
export function setMeetingActivityScope(scope:ActivityScope|null):()=>void {const token=Symbol('meeting');current=scope?{scope,token}:null;return()=>{if(current?.token===token)current=null}}
const tracked=new Set(['saveHeadline','markHeadlineRead','reviewMeetingHeadline','saveRock','saveMilestone','saveTodo','setTodoStatus','completeTodo','createLinkedTodo','saveIssue','solveIssue','archiveIssues','dropToIssue','setScore'])
export function meetingActivityEnvelope(action:string):Record<string,string>{return current&&tracked.has(action)?{liveSessionId:current.scope.sessionId,liveCompanyId:current.scope.companyId}:{}}
export function currentMeetingActivityScope():ActivityScope|null{return current?.scope||null}
