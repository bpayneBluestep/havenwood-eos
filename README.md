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
