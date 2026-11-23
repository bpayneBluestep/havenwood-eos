# Dashboard milestone completion

**Type:** bug fix
**Component:** TenK dashboard
**Tracking:** none
**Status:** published, not verified

## Summary

Make each milestone under a dashboard Rock clickable so a user can mark it complete or reopen it.

## Root cause

The dashboard renders each milestone status as a visual `span`, with no click handler. Its CSS also disables pointer events for that visual marker. Users can see a checkbox but cannot change its state.

## Approach

- [x] [CODE] Replace the visual marker with an accessible button and save completion through the existing `saveMilestone` API.
- [x] [CODE] Remove the CSS rule that blocks pointer events on the milestone marker.

**Sources:** `app/src/routes/My90.tsx`, `app/src/styles.css`, `platform/README.md`, and `docs/rocks-workflow.md`. No BlueStep platform method changes are required.

## Verification

Run the production build. Review the dashboard markup and save call. The live behavior needs a check by a team member who can edit the Rock.

## Notes

The button will use the same `saveMilestone` endpoint and Rock revision check as the Rocks page.
