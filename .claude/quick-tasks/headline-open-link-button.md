# Open Link button in headlines

**Type:** small change
**Component:** TenK GitSite
**Tracking:** none
**Status:** done

## Summary

Show an **Open Link** button on every headline row that has a valid source URL.

## Approach

- [x] [CODE] Add the button to linked new-headline rows and use the label **Open Link** on linked permanent and new headline rows.
- [x] [CODE] Keep external links in a new tab with the existing safe `rel` attributes.

**Sources:** `app/src/routes/Headlines.tsx`, `app/src/api.ts`, and `README.md`. No BlueStep endpoint or platform change is required.

## Verification

`npm run build` passes in a clean worktree based on the current published source. It runs TypeScript checking and Vite production build. The build output contains the Open Link control in `assets/Todos-B0q-2FuC.js`. `git diff --check` passes. No tests were run. The live Headlines page shows Open Link on linked permanent and new headlines.

## Notes

Permanent headline rows already showed a source link. New headline rows did not. Both now show the fixed label **Open Link**, and the link action does not trigger the row editor. The button retains the existing HTTP(S) check and opens a new tab.

The original working copy also had unrelated meeting-template changes. A clean worktree was used to build this headline change without those changes.
