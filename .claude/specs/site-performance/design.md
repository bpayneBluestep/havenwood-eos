# Design — Site performance

**Status:** Approved 21 November 2026

## Component(s) affected

- TenK GitSite SPA (`app/src`) — load feature routes on demand, reduce unnecessary background polling, and isolate live timer updates from large views.
- BlueStep Traction Maestro endpoint — no changes planned. Keep existing access checks and response behavior.

## Platform-side impact

**Does this change require modifying the component on the BlueStep platform? No.**

- The changes stay in the GitSite React app. They do not add or change native fields, queries, permissions, or endpoint actions.

## Approach

1. Replace eager route imports in `app/src/App.tsx` with `React.lazy` and `Suspense`. Load each feature chunk when its route opens. Keep the shell and navigation in the initial bundle. Show the existing loading style during chunk load.
2. Add one visibility-aware polling helper. It will prevent overlapping reads, stop polling when the tab is hidden, and run one refresh when the tab becomes visible. Use it for the live session list, meeting workspace, meeting notes, live meeting navigation badge, and embedded Headlines, Issues, Rocks, and Action Items.
3. Set live session polling to 3 seconds. This matches the interval already described in the project README. Keep meeting notes at 2 seconds to protect live collaboration, but pause the poll in a hidden tab. Keep current 5-second workspace and 10-second embedded-list intervals. Prevent overlapping requests.
4. Move timer ticks into small timer display components. The large live-meeting content and meeting workspace will not rerender only because the displayed time changed. Update visible clocks once per second.
5. Capture baseline and final production JS asset sizes. Measure request counts during a live screen for a fixed time. Measure the Vision page's per-team reads and endpoint response time. If endpoint time, rather than browser work or request frequency, remains the main delay, record it as a separate platform task before changing native queries.

Do not add API response caching. Responses include changing team and meeting data. The existing endpoint remains the source of permissions and current data.

## Data flow

- Route navigation triggers a dynamic chunk import. Route data still loads through the existing functions in `app/src/api.ts`.
- Polling calls keep their current actions, team IDs, credentials, and response shapes. The helper only controls when reads happen and ensures at most one poll per component is active.
- Timer displays derive time from the current server offset and session/workspace state. They do not write data.
- No fields or records are written by this change.

## Edge cases

- If a tab becomes visible while a read is still pending, allow that read to finish, then continue at the normal interval. Do not start a duplicate request.
- If a route changes while a request is in flight, ignore the old response.
- If a route chunk fails to load, show a recoverable error or reload path. Do not leave a permanent blank screen.
- If there is no active session, keep the live meeting lobby refresh active so another user's meeting can appear.
- Keep local timer display correct when the browser wakes after sleep by calculating from timestamps, not by counting ticks.

## Alignment with existing patterns

- The SPA already sends reads and writes through `app/src/api.ts`; keep this boundary.
- Existing route effects cancel stale UI updates. The polling helper will use the same cleanup and active-request pattern.
- Keep all BlueStep access checks server-side. No browser-side cache will grant or preserve access.
- The BlueStep `bsjs-development.md` reference was reviewed. Its import and transaction patterns apply to native endpoint code; this design does not change that code.

## Risks

- Lazy chunks can fail if a deployed asset is missing. Build and live-route checks must confirm that GitSite serves every generated chunk under `/spa/`.
- Hidden-tab pauses mean a participant can see a short delay after returning to a tab. The helper will refresh immediately when the tab becomes visible.
- A 3-second session poll allows up to 2 seconds more delay than the current code for changes made by another participant. Local controls still update from their direct response.
- Rollback: revert the SPA commit and push the prior GitSite build. No platform data migration or endpoint rollback is needed.
