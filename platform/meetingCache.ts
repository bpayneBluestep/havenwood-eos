export interface MeetingCacheRecord {
 forms:{eosMeetings:{formRecord():{id():any}}}
 reset():void
}

/** Flush pending inserts before expiring the record list and its MEFR result. */
export function commitWithMeetingCache(commit:()=>void,records:MeetingCacheRecord[],evict:(key:any)=>void,reportId:string):void {
 commit()
 if(!records.length)return
 for(const record of records)evict(record.forms.eosMeetings.formRecord().id())
 evict(reportId)
 for(const record of records)record.reset()
}
