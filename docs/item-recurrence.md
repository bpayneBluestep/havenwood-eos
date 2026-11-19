# Item recurrence (todos, issues, headlines)

Recurring schedules live on each `eosTodos` / `eosIssues` / `eosHeadlines` `dataJSON` row as optional `recurrence`. Permanent items stay a separate boolean (`permanent`); recurrence is the cadence that creates the next open instance.

## Shape

```ts
{
  freq: 'weekly' | 'biweekly' | 'monthly' | 'custom',
  interval: number,       // weeks or months; biweekly floors at 2
  weekdays: number[],     // 0=Sun … 6=Sat
  start: 'YYYY-MM-DD',
  until: 'YYYY-MM-DD' | null,
  seriesId: string
}
```

Pure helpers: `platform/itemRecurrence.ts` (keep identical to `scripts/itemRecurrence.ts` on Traction Maestro).

## Saves

`saveTodo`, `saveIssue`, and `saveHeadline` accept `recurrence` (object or null). Normalize with `normalizeRecurrence`. Team and personal todos use the same field; personal stays `personal: true`.

## Completing a recurring action item

1. Mark the current instance done.
2. Archive it (`archivedAt`).
3. Create the next open todo with `dueDate = nextOccurrence(...)` and the same `recurrence` / owner / personal / meeting context.

Prefer a Traction `completeTodo` action that does those steps in one write. Until it is published, the SPA falls back to `setTodoStatus` + `saveTodo` (archive) + `saveTodo` (spawn) via `completeTodo` / `toggleTodoCompletion` in `app/src/api.ts`.

Publish the endpoint helper before relying on server-side atomicity. The SPA already ships the cadence builder and client fallback.
