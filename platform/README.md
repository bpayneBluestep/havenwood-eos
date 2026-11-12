# BlueStep endpoint patch — review required

This folder is a review artifact. GitHub does not publish this endpoint.
The frontend requires capability `meetingWorkflow: 1` from `/b/traction`.
Without it, existing lists work and live meeting tools show an unavailable message.

## Baseline and deployment order

Patch baseline: the freshly pulled Traction Maestro `draft/scripts/app.ts`.
SHA256: `f4b91df0cc3a63afc3ec37def8ebe93c1f1743410f3eefc72ba2819fbd1d2aaf`.

1. Pull and compare the current platform component. Do not overwrite newer platform edits.
2. Apply `traction-meeting-workflow.patch` to `scripts/app.ts` in a review copy.
3. Add `meetingService.ts` and `meetingModel.ts` beside that script.
4. Review and compile through BlueStep. The bridge uses verified existing form names and fields. Platform compilation and transaction behavior still need confirmation.
5. Test with an owner, attendee, excluded employee, and selected-team employee in a non-production instance. Test simultaneous writes and failed commits. Confirm that rejected operations commit no partial writes. Confirm that a first-session creation cannot create duplicate session rows under concurrent requests. This is a release gate.
6. Publish the endpoint only after explicit approval. Then merge the frontend PR. The repository's main branch deploys the static SPA automatically.

No new form or field IDs are required. Optional JSON fields preserve old records. Internal `live_session` and `meeting_disclosures` rows use the existing EOS Meetings form and are excluded from calendar lists. Confirm that platform row permissions allow the existing endpoint to write these rows for accessible teams.

## Access and disclosure

Private meeting occurrence access remains required. The creator controls its timer. A legacy meeting without a creator uses its first series attendee. The first person to configure or start an L10 session becomes its owner. A full platform super retains the existing override.

All four item types have one accountable person and an optional multi-team disclosure list. Issues also have a separate responsible team. Responsibility alone never grants visibility. Disclosure sends read-only item copies to selected teams' lists and L10 meetings. It does not expose the attendee list or other items. Edit the original from its source meeting. Updates, archives and revoked teams update the copies. An editor must retain access to all previously disclosed teams. Otherwise, a user with that access must make the change.

The source records retain immutable meeting/date/section links. Existing native status and assignment actions synchronize disclosure copies. Linked to-dos and converted issues retain source context but start with no disclosure. Archived rock carry-forwards also start without disclosure. Old items without context are not reconstructed into an agenda section.

## Milestone status extension

The patch also advertises `milestoneWorkflow: 1`. The existing `saveMilestone` action validates `not_started`, `in_progress`, `blocked` and `complete`, and synchronizes the existing `done` and `completedAt` fields. Old checkbox clients remain supported. See `docs/rocks-workflow.md`.

## Verification

The pure timer and service tests run with `npm test`. The SPA type check and build run with `npm run typecheck` and `npm run build`. The development-only `/meeting-preview.html` uses synthetic records and an in-memory service; it makes no BlueStep writes and is not included in the production artifact.

The patch was checked for clean application. It has not been compiled or executed on BlueStep. Live multi-user synchronization, private row permissions and transactional conflict handling remain platform release gates. Polling updates participants about every five seconds; the countdown renders locally from the server timestamp.
