# Tasks — Site performance

**Status:** Complete

## Tasks

- [x] **1. [CODE] [judgment]** Load feature routes on demand. Replace eager route imports with `React.lazy` and `Suspense`. Include the Admin view rendered from app state. Keep the site shell visible while a route chunk loads. Add a recoverable error state for a failed chunk load. — files: `app/src/App.tsx`, `app/src/state.tsx`
- [x] **2. [CODE] [judgment]** Add a visibility-aware polling hook. It must avoid overlapping requests, stop reads while the tab is hidden, refresh once when the tab becomes visible, and ignore state updates after cleanup. — files: `app/src/lib/useVisiblePolling.ts`, `app/src/lib/useVisiblePolling.test.tsx`
- [x] **3. [CODE] [routine]** Use the polling hook for live meeting reads. Set session polling to 3 seconds. Keep the existing notes, workspace, and navigation polling intervals. — files: `app/src/meetings/LiveMeetings.tsx`, `app/src/meetings/MeetingWorkspace.tsx`, `app/src/meetings/MeetingNotes.tsx`, `app/src/components/LiveMeetingLink.tsx`
- [x] **4. [CODE] [routine]** Use the polling hook for embedded work lists. Keep the current 10-second intervals, pause refreshes in hidden tabs, and refresh when the team or filters change. — files: `app/src/routes/Headlines.tsx`, `app/src/routes/Issues.tsx`, `app/src/routes/Todos.tsx`, `app/src/routes/Rocks.tsx`, `app/src/routes/L10.tsx`, `app/src/lib/useVisiblePolling.ts`, `app/src/lib/useVisiblePolling.test.tsx`
- [x] **5. [CODE] [judgment]** Isolate live timer updates. Update timer text once each second without rerendering the full meeting workspace, agenda, or embedded EOS lists. — files: `app/src/meetings/LiveMeetings.tsx`, `app/src/meetings/MeetingWorkspace.tsx`
- [x] **6. [CODE] [routine]** Measure and record the release. Capture initial and route chunk sizes before and after. Check live read cadence and Vision's per-team reads and response time. Build the SPA, run the existing regression suite, and verify the main route loads and live meeting controls work. Update documentation with actual intervals and measurements. — files: `README.md`, `.claude/specs/site-performance/release-report.md`

## Deployment

- TenK GitSite repository: commit the source and generated `index.html`/`assets/` build output, then push to `main` to deploy to `tenk.bluestep.net`.
- No BlueStep endpoint or platform configuration changes are planned.

## Verification

- Compare initial JS bytes before and after, and confirm that unvisited feature chunks are not part of the initial load.
- Confirm that a hidden tab makes no scheduled reads and that returning to it causes one refresh.
- Confirm that a live meeting displays accurate timers and receives other-user changes within the chosen polling window.
- Run the existing SPA regression suite and production build. Check the main routes in the deployed site.
- If BlueStep endpoint response time remains the main delay, record the evidence and propose a separate platform task. Do not alter native queries in this release.
