"""Generate a review-only patch against a freshly pulled endpoint. Does not publish."""
from pathlib import Path
import difflib,sys
root=Path(__file__).resolve().parent.parent
base=Path(sys.argv[1]).read_text()
source=base
source="import {MeetingError,readWorkspace,commandWorkspace,captureItem,synchronizeDisclosures} from './meetingService';\n"+source
source=source.replace("const MEETING_ITEM_FORMS = ['eosIssues', 'eosTodos', 'eosHeadlines'];","const MEETING_ITEM_FORMS = ['eosIssues', 'eosTodos', 'eosHeadlines', 'eosRocks'];")
source=source.replace("  const spec = REAL_FIELDS[form];\n  const d = parseJson(entry.fields[memoField].val(), {});\n  for (const k in patch)","  const spec = REAL_FIELDS[form];\n  const previousMeetingValue = memoField === 'dataJSON' ? toEntity(entry,form,memoField) : null;\n  const d = parseJson(entry.fields[memoField].val(), {});\n  for (const k in patch)",1)
source=source.replace("  entry.fields[memoField].val(JSON.stringify(d));\n  return d.rev;","  entry.fields[memoField].val(JSON.stringify(d));\n  if (previousMeetingValue) meetingTrack(entry,form,previousMeetingValue);\n  return d.rev;",1)
source=source.replace("  const mid = str(e.fields.meetingId ? e.fields.meetingId.val() : '', '');","  const mid = str(e.fields.meetingId ? e.fields.meetingId.val() : parseJson(e.fields.dataJSON.val(),{}).meetingId, '');")
source=source.replace("return !!m && canSeeMeetingItem(m, e.fields.occurrenceDate ? dateStr(e.fields.occurrenceDate) : '', myRecordId());", "return !!m && canSeeMeetingItem(m, e.fields.occurrenceDate ? dateStr(e.fields.occurrenceDate) : str(parseJson(e.fields.dataJSON.val(),{}).occurrenceDate,''), myRecordId());")
source=source.replace("      const r = rockOf(e);\n      if ((rollUpOnly", "      const r = rockOf(e);\n      if (!isCompanyItem(r)) continue;\n      if ((rollUpOnly",1)
source=source.replace("      out.push(r);\n    }\n  }\n  return out;\n}\n\nfunction issueOf", "      out.push(r);\n    }\n    if(!rollUpOnly) out.push.apply(out,sharedMeetingItems(c,'rock'));\n  }\n  return out;\n}\n\nfunction issueOf",1)
source=source.replace("  out.sort(function (a, b) {\n    const ad = a.dueDate", "  for(const t of sharedMeetingItems(company,'todo'))if(!mineOnly||t.ownerId===myId)out.push(t);\n  out.sort(function (a, b) {\n    const ad = a.dueDate",1)
source=source.replace("function commit(): boolean {\n", "function commit(): boolean {\n  meetingFlush();\n",1)
bridge=(root/'platform/bridge.ts').read_text()
source=source.replace('// ===========================================================================\n// Handler',bridge+'\n// ===========================================================================\n// Handler',1)
needle="    switch (action) {"
handlers="""
      case 'meetingWorkspace':
      case 'commandMeetingWorkspace':
      case 'captureMeetingItem':
      case 'editMeetingItem': {
        const input:any=Object.assign({},rawBody,{companyId:IN('companyId'),meetingId:IN('meetingId'),date:IN('date')});
        try {
          if(action!=='meetingWorkspace'&&String(B.net.request.method())!=='POST'){fail('INVALID','Use POST for meeting changes.');break;}
          const store=meetingStore();
          const result=action==='meetingWorkspace'?readWorkspace(store,input):action==='commandMeetingWorkspace'?commandWorkspace(store,input):captureItem(store,input,action==='editMeetingItem');
          if(action!=='meetingWorkspace')commit();
          ok(result);
        } catch(error) {const e:any=error;fail(e.code||'INVALID',e.message||'Meeting change failed.');}
        break;
      }
"""
source=source.replace(needle,needle+handlers,1)
source=source.replace('          me: meObj(),','          capabilities:{meetingWorkflow:1,milestoneWorkflow:1},\n          me: meObj(),',1)
# Internal session/disclosure rows are not calendar meetings.
source=source.replace("          const m = meetingOf(e);\n          if (!includeArchived","          const m = meetingOf(e);\n          if(m.kind!=='meeting')continue;\n          if (!includeArchived",1)
# Public L10 must never include private rocks. Disclosed snapshots are explicit.
source=source.replace("if (live(r) && r.quarterKey === qk) rocks.push(r);", "if (live(r) && isCompanyItem(r) && r.quarterKey === qk) rocks.push(r);")
source=source.replace("        rocks.sort(function (a, b) { return a.companyRock", "        rocks.push.apply(rocks,sharedMeetingItems(c,'rock').filter(function(r:any){return r.quarterKey===qk;}));\n        rocks.sort(function (a, b) { return a.companyRock",1)
source=source.replace("        // Last week's to-do list", "        heads.push.apply(heads,sharedMeetingItems(c,'headline').filter(function(h:any){return !h.readDate;}));\n        // Last week's to-do list",1)
source=source.replace("        issues.sort(sortByRank);\n\n        // Conventional durations", "        issues.push.apply(issues,sharedMeetingItems(c,'issue').filter(function(i:any){return i.status==='open'&&i.term==='short';}));\n        issues.sort(sortByRank);\n\n        // Conventional durations",1)
source=source.replace("if (!live(r) || r.ownerId !== myId) continue;", "if (!live(r) || r.ownerId !== myId || !itemVisible(c,r,myId)) continue;",1)
# Native issue/headline list reads add only the selected team's disclosures.
start=source.index("      case 'issues':")
end=source.index("      case 'saveIssue':",start)
chunk=source[start:end].replace('        rows.sort(sortByRank);',"        rows.push.apply(rows,sharedMeetingItems(c,'issue').filter(function(i:any){return (!term||i.term===term)&&(!status||i.status===status);}));\n        rows.sort(sortByRank);")
source=source[:start]+chunk+source[end:]
start=source.index("      case 'headlines':")
end=source.index("      case 'saveHeadline':",start)
chunk=source[start:end].replace('        rows.sort(function',"        rows.push.apply(rows,sharedMeetingItems(c,'headline').filter(function(h:any){return !unreadOnly||!h.readDate;}));\n        rows.sort(function",1)
source=source[:start]+chunk+source[end:]
# Separate responsible-team assignment in the existing issue editor.
start=source.index("      case 'saveIssue':");end=source.index("      case 'rankIssues':",start)
chunk=source[start:end].replace("        const patch: any = { title: title };", "        const responsible=IN('responsibleTeamId')===undefined?undefined:!IN('responsibleTeamId')?null:pickCompany(companies,IN('responsibleTeamId'));\n        if(IN('responsibleTeamId')&& !responsible){fail('FORBIDDEN','Choose a team you can access.');break;}\n        const patch: any = { title: title };\n        if(IN('responsibleTeamId')!==undefined){patch.responsibleTeamId=str(IN('responsibleTeamId'),'');patch.responsibleTeamName=responsible?responsible.name:'';}")
source=source[:start]+chunk+source[end:]
# Keep owner names accurate when the existing issue editor changes an owner.
start=source.index("      case 'saveIssue':");end=source.index("      case 'rankIssues':",start)
chunk=source[start:end].replace("if (IN('ownerId') !== undefined) patch.ownerId = str(IN('ownerId'), '');", "if (IN('ownerId') !== undefined) {patch.ownerId = str(IN('ownerId'), '');patch.ownerName=patch.ownerId?personLabel(patch.ownerId):'';}")
source=source[:start]+chunk+source[end:]
# Native archive and carry-forward actions must not drop privacy or disclosures.
start=source.index("      case 'carryForwardRocks':");end=source.index("      case 'archiveQuarter':",start)
chunk=source[start:end].replace("title: src.title, description: src.description, ownerId: src.ownerId,", "title: src.title, description: src.description, ownerId: src.ownerId, meetingId:src.meetingId||'',occurrenceDate:src.occurrenceDate||'',meetingSource:src.meetingSource||null,sharedTeamIds:[],")
chunk=chunk.replace("hit.entry.fields.archivedAt.val(today());", "applyPatch(hit.entry,'eosRocks','dataJSON',{archivedAt:String(today().toString())});")
source=source[:start]+chunk+source[end:]
start=source.index("      case 'archiveQuarter':");end=source.index("      case 'issues':",start)
chunk=source[start:end].replace("          if (str(e.fields.quarterKey.val(), '') !== qk) continue;", "          if(!isCompanyItem(rockOf(e)))continue;\n          if (str(e.fields.quarterKey.val(), '') !== qk) continue;").replace("e.fields.archivedAt.val(stamp);", "applyPatch(e,'eosRocks','dataJSON',{archivedAt:String(stamp.toString())});")
source=source[:start]+chunk+source[end:]
start=source.index("      case 'archiveIssues':");end=source.index("      case 'dropToIssue':",start)
chunk=source[start:end].replace("hit.entry.fields.archivedAt.val(stamp);", "applyPatch(hit.entry,'eosIssues','dataJSON',{archivedAt:String(stamp.toString())});")
source=source[:start]+chunk+source[end:]
# Preserve source section when a native item is converted into an issue.
start=source.index("      case 'dropToIssue':");end=source.index("      case 'todos':",start)
chunk=source[start:end].replace("let mt: any = null;", "let mt: any = null;let sourceContext:any=null;")
chunk=chunk.replace("origin.kind === 'headline' ? 'eosHeadlines' : ''", "origin.kind === 'headline' ? 'eosHeadlines' : origin.kind === 'rock' ? 'eosRocks' : ''")
chunk=chunk.replace("originForm === 'eosIssues' ? 'issueId' : 'headlineId'", "originForm === 'eosIssues' ? 'issueId' : originForm === 'eosRocks' ? 'rockId' : 'headlineId'")
chunk=chunk.replace("const srcMid = str(src.entry.fields.meetingId.val(), '');", "const sourceItem=toEntity(src.entry,originForm,'dataJSON');sourceContext=sourceItem.meetingSource||null;const srcMid=str(sourceItem.meetingId,'');")
chunk=chunk.replace("occurrenceDate: dateStr(src.entry.fields.occurrenceDate)", "occurrenceDate:str(sourceItem.occurrenceDate,'')")
chunk=chunk.replace("linkedTodoIds: [], discussion: [],", "linkedTodoIds: [], discussion: [],meetingSource:sourceContext,sharedTeamIds:[],")
source=source[:start]+chunk+source[end:]
source=source.replace("occurrenceDate: dateStr(hit.entry.fields.occurrenceDate)\n        });", "occurrenceDate: dateStr(hit.entry.fields.occurrenceDate), meetingSource:issueOf(hit.entry).meetingSource||null,sharedTeamIds:[]\n        });",1)
# Milestone workflow is additive to the existing done flag.
start=source.index("      case 'saveMilestone':");end=source.index("      case 'addRockNote':",start)
chunk=source[start:end].replace("        const list: any[]", "        if(ms.status!==undefined&&['not_started','in_progress','blocked','complete'].indexOf(ms.status)<0){fail('INVALID','Choose a valid milestone status.');break;}\n        const list: any[]",1)
chunk=chunk.replace("          applyPatch(hit.entry, 'eosRocks', 'dataJSON', { milestones: list });", "          if(ms.status!==undefined){found.status=ms.status;found.done=ms.status==='complete';found.completedAt=found.done?(found.completedAt||nowIso()):null;}else if(ms.done!==undefined){found.status=found.done?'complete':'not_started';}\n          applyPatch(hit.entry, 'eosRocks', 'dataJSON', { milestones: list });",1)
chunk=chunk.replace("ownerId: str(ms.ownerId, ''), done: bool(ms.done),", "ownerId: str(ms.ownerId, ''), status:ms.status===undefined?(bool(ms.done)?'complete':'not_started'):ms.status,done:ms.status===undefined?bool(ms.done):ms.status==='complete',")
chunk=chunk.replace("completedAt: bool(ms.done) ? nowIso() : null", "completedAt: (ms.status===undefined?bool(ms.done):ms.status==='complete') ? nowIso() : null")
source=source[:start]+chunk+source[end:]
patch=''.join(difflib.unified_diff(base.splitlines(True),source.splitlines(True),fromfile='a/scripts/app.ts',tofile='b/scripts/app.ts'))
(root/'platform/traction-meeting-workflow.patch').write_text(patch)
(root/'platform/meetingModel.ts').write_text((root/'app/src/meetings/model.ts').read_text())
print('Generated endpoint patch and shared model. No platform writes.')
