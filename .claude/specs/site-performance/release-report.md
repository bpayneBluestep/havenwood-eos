# Site performance release report

Date: 2026-11-21

## Bundle sizes

The previous production artifact loaded one JavaScript file with 554,523 bytes (162,433 gzip bytes) and one CSS file with 60,852 bytes (12,216 gzip bytes).

The new HTML entry loads `index-deo-a2cU.js` (209,300 bytes; 68,460 gzip bytes) and `index-BZdwotgZ.css` (36,751 bytes; 7,946 gzip bytes). The entry JavaScript is 62.2% smaller by raw size and 57.8% smaller by gzip size. Entry CSS is 39.6% smaller by raw size and 34.9% smaller by gzip size. Combined entry JavaScript and CSS gzip size fell from 174,649 bytes to 76,406 bytes, a 56.2% reduction.

Feature routes now load separate chunks when used. The Meetings chunk is 114,696 bytes (36,558 gzip bytes). The Admin chunk is 44,122 bytes (12,624 gzip bytes). The Vision chunk is 28,448 bytes (7,868 gzip bytes). These chunks are not part of the initial HTML entry.

## Reads and timers

- Live session state refreshes every 3 seconds.
- Meeting notes refresh every 2 seconds.
- Meeting workspace data refreshes every 5 seconds.
- The Live Meetings menu refreshes every 10 seconds.
- Embedded Headlines, Issues, Action Items, Rocks, and L10 lists refresh every 10 seconds.
- These pollers pause when the browser tab is hidden. They refresh once when it becomes visible and do not overlap requests.
- Meeting timer displays update once per second. Attendee connection indicators update every 5 seconds.

## Vision request count

After the module context is loaded, a full Vision page makes 3 company data reads plus one Rocks read and one Issues read for each team in the selected company: `3 + (2 × team count)`. The route also makes one separate module-context read. The embedded Vision view skips Issues: `3 + team count`, plus its module-context read when it loads the module. Plan and priority reads run in parallel. Rocks and Issues requests each fan out across teams. The current code still has per-team request fan-out.

The authenticated browser inspection did not expose BlueStep endpoint resource timing. This release report therefore does not claim an endpoint response-time measurement. The source shows the request count, but live endpoint latency needs server-side logs or browser network timing access. No endpoint query changes were made.

## Verification

- `npm test -- --reporter=dot`: passed, 53 test files and 439 tests after merging the latest `main` changes.
- `npm run build`: passed with TypeScript and Vite.
- `git diff --check`: passed.
- After the push, the authenticated TenK main route loaded and used `/spa/assets/index-deo-a2cU.js`. The UI showed the dashboard and current team data.
- After the push, `/meetings` loaded. Its `Start a meeting` and `Past meetings` controls were visible. I did not click the controls because that would change shared meeting state. I left the existing live meeting untouched.
- Release commit: `025879c` pushed to `main`.
- No meeting was started, ended, or changed during verification.

## Remaining check

The deployed lobby and controls load. This check did not start a meeting or change timer state. The current live session in the browser was left untouched.
