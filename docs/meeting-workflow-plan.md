# Live meeting workflow

## Existing product and gaps

The current L10 page displays agenda durations as labels. It has no timer or meeting session. Private meetings have recurrence, occurrence invitations, to-dos, issues and headlines. To-dos can be assigned at creation. Rocks, to-dos and issues have existing owner editors in their list pages. Private meeting cards do not allow reassignment. Headlines have no accountable owner. No item records its agenda section, and private meetings have no rocks. An issue's existing teamId controls access; it must not be reused as a separate responsibility assignment.

## Implementation plan

- Screens: add shared live-meeting workspace to private meetings and L10. Add inline capture, owner/team editing and a session-end recap. Show links and responsibility in native follow-up lists. Preserve existing list editors and meeting access.
- Timer: configurable sections/questions with stable IDs and positive durations. Server-owned running/paused/ended state uses timestamps, elapsed time and a revision. Reload/polling reconstructs remaining time. Time expiry shows overtime; no automatic advance or meeting end. Editing the current duration preserves elapsed time. Next resets elapsed for the next item. Last item remains active until End. No sounds or notifications.
- Ownership: private meeting creator controls the timer; legacy records use their existing creator ID, with first series attendee only as an explicit legacy fallback. The first person to configure or start owns a team L10 session. Ordinary attendees may capture/assign items but cannot operate another owner's timer. A full platform super retains its existing administrative override.
- Data: versioned meetingWorkspace JSON on the existing EOS Meetings dataJSON. Each captured native item retains immutable session ID, meeting ID/date, section ID/label and source. Rocks store private meeting linkage in existing JSON; all rock readers and direct lookups must honor it. Headlines gain ownerId/name in JSON. Issues gain responsibleTeamId/name separate from access-controlling teamId.
- Privacy: responsibility does not grant access to a private meeting or item. Assign only to eligible people and to a team the caller can access. No automatic movement or sharing. Each item has a multi-team disclosure picker. Only selected teams receive read-only copies in their lists and L10 meetings. The original remains the source record. Changes, revocations and archives update those copies. Disclosure does not reveal other meeting items or its attendee list. Editing occurs in the source meeting. The editor must still have access to all previously selected teams to change a disclosed item.
- Migration: optional JSON fields only, no new forms or fabricated field IDs. Old records remain readable, with Unassigned / No responsible team. Existing scalar teamId values remain unchanged. No bulk rewrite. Original records remain native records in their current access scope.
- Delivery: push a feature branch and PR. main auto-deploys to hope-eos.bluestep.net. The matching endpoint patch must be reviewed and published first, with an explicit BlueStep publish decision. The frontend detects an older endpoint and does not display unsupported actions as working.

## Acceptance checks

- Owner can configure, start, pause, resume, move next and end; participants see shared status and cannot control the timer.
- Expiry continues counting overtime; neither item nor meeting ends automatically.
- Current duration changes preserve elapsed time. Running timers recover after refresh and polls. Invalid/stale commands fail.
- Each agenda section/question can capture a rock, headline, to-do or issue inline, with owner editing and clear missing-owner state.
- Native records retain their meeting/date/section links after editing, completion and reassignment.
- Issues have a distinct responsible-team picker and filter. Private content stays private unless the user selects disclosure teams. Responsibility alone never grants access.
- The end recap includes captured records and assignments, including missing assignments.
- Old endpoints/old records remain usable, without claims that new functionality is live.

## Deployment dependencies

Existing BlueStep session and team/occurrence access are required. No GitHub push can update the endpoint code. The backend patch is prepared against the pulled Traction Maestro component; platform compilation, nonprivileged user tests and concurrency checks remain mandatory before live rollout.
