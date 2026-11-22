# Requirements — Site performance

**Status:** Approved 21 November 2026
**Tracking:** none

## Context

The user asked for a review of the whole TenK site and fixes for slow operations. The site is a React SPA in `app/`, deployed as a BlueStep GitSite. A first code review found that `App.tsx` imports all feature pages up front, including admin, meetings, charts, directory, and archive. The live-meeting client polls session state every second, meeting notes every two seconds, and the live workspace rerenders its full agenda four times each second to update the timer. Embedded work lists poll every ten seconds. `Vision.tsx` also starts separate requests for rocks and issues for each team.

## User stories

- As a TenK user, I want the site to load quickly, so I can get to my work without waiting for every feature to download.
- As a meeting participant, I want shared meeting data to stay current, so I can work with the team without excess server requests or slow controls.
- As a user, I want tables and forms to remain responsive while timers update, so the meeting timer does not slow the rest of the screen.

## Acceptance criteria

- [ ] Load route code only when a user opens that feature. Keep the navigation and loading state usable while a feature loads.
- [ ] Reduce background polling. Do not poll while the browser tab is hidden. Refresh promptly when it becomes visible again.
- [ ] Update live timers without rerendering large meeting agendas, tables, or forms on each timer tick.
- [ ] Keep archive, admin, meetings, scorecard, rocks, issues, action items, headlines, planning, directory, and profile behavior intact.
- [ ] Keep data access and permission checks on the BlueStep endpoint. Do not cache private or changing API responses in a way that can expose stale or cross-team data.
- [ ] Record before and after initial JS transfer size and request cadence for live meetings. Verify the production build and key page flows before release.
- [ ] Measure the Vision page's per-team reads and response time. If this is a main delay, document it for a separate endpoint task.

## Out of scope

- No changes to TenK business rules, BlueStep permissions, data models, or notification delivery.
- No changes to meeting agenda contents or meeting notes behavior beyond polling cadence and render performance.
- No new performance monitoring vendor or analytics service.
