# havenwood-eos

Static SPA deployable as a BlueStep GitSite, served under `/spa/`.

Source lives in `app/`. The committed build artifact at the repo root
(`index.html` + `assets/`) **is** what GitSite serves — no server build runs.

## Commands

```
npm install
npm run dev        # local dev server
npm run build      # emits index.html + assets/ to the repo root
npm run typecheck
```

## Deploy

Commit the build output and push to `main`. The BlueStep GitSite
(`hope-eos.bluestep.net`) redeploys on push via webhook.

## Interface behavior

Rocks with milestones calculate status from dates and completion. All complete means Done. An incomplete milestone due before today means Off Track. Other Rocks with milestones are On Track. Rocks without milestones retain manual status. The Rocks list recalculates when the date changes. Milestone due dates have inline Save and Cancel controls and retain failed edits for correction.

Issues show full owner names on the left, optional owner/date sorting, saved importance from 1 (lowest) to 5 (highest), and collapsed details. Drag reordering is available in manual order only. To-Dos support owner/date sorting and an Overdue filter that combines with Team or Mine. Titles open the Notes editor. Read-only To-Dos open a locked detail view. Headlines support author/date sorting and show full note text in a detail dialog.

Scorecard periods run newest first. Cells match headings by period key. Shared action menus render in a portal outside scroll containers, support Escape and arrow keys, and remain within the viewport.

The server status helper is `platform/rockStatus.ts`. Its matching BlueStep endpoint module is `scripts/rockStatus.ts`. Keep these files identical. The endpoint computes status on reads and stores it with milestone writes. Deploy this endpoint update before the frontend.

Run `npm test`, `npm run typecheck`, and `npm run build` before deployment. Browser checks for this change used synthetic data at desktop and mobile widths; these checks do not prove live-user permissions or live write persistence.

## Browser review changes

Issue titles open an editor inside the row. Save sends the original revision; a failed save retains the text. Details are on the right with the Solved action. A toolbar above the list filters by owner and sorts by topic, owner, or creation date. IDS instructions appear next to the heading.

Rocks open with milestones collapsed. Descriptions have a separate expand control. Rock titles open the text editor. Owner, Rock, and milestone rows have distinct left insets.

Scorecard definitions support an optional http/https source link and multiple assigned teams. The source team remains assigned and manages the definition. Assigned-team members can view the shared measurable and enter its scores. All teams use one stored score series. A viewer cannot assign a new team that they cannot access. A source editor can retain existing assignments after their own team access changes. Removing an assignment removes that team's shared access.

Manage sections changes section names and order for the selected team's cadence. The save includes every row revision and rejects stale plans before writes. Section presentation changes do not alter another team's section names or assignments. Shared cells retain a separate source score key so different team calendars write to the same source series.

The pure policy helper is `platform/scorecardModel.ts`; its matching endpoint module is `scripts/scorecardModel.ts`. Keep these identical. This endpoint update adds the `scorecardEditing: 1` bootstrap capability. Publish it before the frontend. Existing native fields carry all new data in the measurable definition JSON; no form or field migration is required.

Issue ranking numbers are dropdown controls in the list. Selecting 1–5 saves immediately with a revision check, without opening the issue. A failed save restores the previous number and shows an error. Read-only issues and the row currently being edited remain locked.
