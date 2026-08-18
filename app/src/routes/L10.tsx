import { useCallback, useEffect, useState } from 'react'
import { getL10, setScore, setRockStatus, setTodoStatus, markHeadlineRead } from '../api'
import type { L10 as L10Data, Rock, Issue, Todo, Headline, Measurable, Cell } from '../api'
import { useApp } from '../state'
import {
  Avatar, Empty, ErrorBanner, Loading, RowMenu,
  cellClass, cellMark, dueClass, fmtDate, fmtGoal, firstLast, shortPeriod,
} from '../lib/ui'
import { DropToIssueModal, LinkedTodoModal } from '../components/DropToIssue'

/*
 * The L10 view.
 *
 * This is NOT a meeting app. They run Level 10s and do not want software driving
 * them — so this is one page that stacks the five lists in agenda order, loads in
 * ONE request so it appears at once when someone screen-shares it, and is
 * editable in place.
 *
 * Deliberately absent: no meeting record, presenter, polling, attendance,
 * ratings, recap or history. Nothing is stored. Reload it and you get the current
 * state of the five lists — the only state that ever mattered.
 *
 * The durations are LABELS. Nothing counts down.
 */
export default function L10() {
  const { company, nameOf } = useApp()
  const [data, setData] = useState<L10Data | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [drop, setDrop] = useState<{ kind: string; id: string; label: string; title: string } | null>(null)
  const [linkFor, setLinkFor] = useState<Issue | null>(null)

  const load = useCallback(() => {
    setErr(null)
    getL10(company.id).then(setData).catch(e => setErr(e.message))
  }, [company.id])

  useEffect(() => { setData(null); load() }, [load])

  if (!data && !err) return <div className="page"><Loading what="Loading the meeting" /></div>

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1>Level 10 — {data?.company.settings.displayName || company.name}</h1>
          <div className="page__sub">
            Week of {data?.weekLabel} · {data?.quarterKey} · everything here is live and editable
          </div>
        </div>
        <div className="page__actions">
          <button className="btn" onClick={load}>Refresh</button>
        </div>
      </div>

      <ErrorBanner error={err} onDismiss={() => setErr(null)} />

      {data && (
        <>
          <Section n={1} item={data.agenda[0]}>
            <div className="card__body">
              <p className="muted" style={{ margin: 0 }}>
                One personal and one professional good-news item from everyone. No business — this
                part is for the humans in the room.
              </p>
            </div>
          </Section>

          {/* Scorecard — read the numbers. Off track drops to Issues. No discussion. */}
          <Section n={2} item={data.agenda[1]} count={data.scorecard.rows.length}>
            <ScorecardSection
              scorecard={data.scorecard}
              onSaved={load}
              onError={setErr}
              onDrop={(m: Measurable) =>
                setDrop({ kind: 'measurable', id: m.id, label: m.title, title: `${m.title} has missed goal 3 periods running` })
              }
            />
          </Section>

          {/* Rock review — each owner says On Track or Off Track. No discussion. */}
          <Section n={3} item={data.agenda[2]} count={data.rocks.length}>
            {data.rocks.length === 0 ? (
              <Empty title="No rocks this quarter" />
            ) : (
              <div className="rows">
                {data.rocks.map(r => (
                  <RockLine
                    key={r.id}
                    rock={r}
                    onSaved={load}
                    onError={setErr}
                    onDrop={() => setDrop({ kind: 'rock', id: r.id, label: r.title, title: `${r.title} is off track` })}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Headlines — unread only, so nothing is silently dropped. */}
          <Section n={4} item={data.agenda[3]} count={data.headlines.length}>
            {data.headlines.length === 0 ? (
              <Empty title="No unread headlines" />
            ) : (
              <div className="rows">
                {data.headlines.map(h => (
                  <HeadlineLine
                    key={h.id}
                    headline={h}
                    onSaved={load}
                    onError={setErr}
                    onDrop={() => setDrop({ kind: 'headline', id: h.id, label: h.body, title: h.body })}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* To-Dos — last week's list. The 90% target is the one bit of meeting
              arithmetic nobody does by hand. */}
          <Section
            n={5}
            item={data.agenda[4]}
            right={<CompletionMeter done={data.todos.completed} total={data.todos.total} pct={data.todos.pct} target={data.todos.target} />}
          >
            {data.todos.rows.length === 0 ? (
              <Empty title="Nothing to review" />
            ) : (
              <div className="rows">
                {data.todos.rows.map(t => (
                  <TodoLine
                    key={t.id}
                    todo={t}
                    onSaved={load}
                    onError={setErr}
                    onDrop={() => setDrop({ kind: 'todo', id: t.id, label: t.title, title: t.title })}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* IDS — the meeting. Solve the top issues one at a time. */}
          <Section n={6} item={data.agenda[5]} count={data.issues.length}>
            {data.issues.length === 0 ? (
              <Empty title="No open short-term issues">
                An empty IDS list is either a very good week or a sign nobody is dropping things here.
              </Empty>
            ) : (
              <div className="rows">
                {data.issues.map((issue, i) => (
                  <div className="rowitem" key={issue.id}>
                    <span className={'rank' + (i < 3 ? ' rank--top' : '')}>{i + 1}</span>
                    <div className="rowitem__main">
                      <div className="rowitem__title">
                        {issue.title}
                        {issue.origin && issue.origin.kind !== 'manual' && (
                          <span className="pill pill--muted">from {issue.origin.kind}</span>
                        )}
                      </div>
                      {issue.description && <div className="rowitem__meta">{issue.description}</div>}
                    </div>
                    <div className="rowitem__end">
                      {issue.ownerId && <Avatar name={nameOf(issue.ownerId)} id={issue.ownerId} sm />}
                      <span className="mono faint">P{issue.priority ?? '–'}</span>
                      <button className="btn btn--sm" onClick={() => setLinkFor(issue)}>Solve → To-Do</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section n={7} item={data.agenda[6]}>
            <div className="card__body">
              <p className="muted" style={{ marginTop: 0 }}>
                Recap the To-Dos created, confirm who is telling whom, and close.
              </p>
              <div className="kpis">
                <div className="kpi">
                  <div className="kpi__v">{data.issues.length}</div>
                  <div className="kpi__l">Issues still open</div>
                </div>
                <div className="kpi">
                  <div className="kpi__v">{data.todos.rows.filter(t => t.status === 'open').length}</div>
                  <div className="kpi__l">To-Dos carried</div>
                </div>
                <div className="kpi">
                  <div className="kpi__v">{data.rocks.filter(r => r.status === 'off_track').length}</div>
                  <div className="kpi__l">Rocks off track</div>
                </div>
              </div>
            </div>
          </Section>
        </>
      )}

      {drop && (
        <DropToIssueModal
          origin={{ kind: drop.kind, id: drop.id, label: drop.label }}
          suggestedTitle={drop.title}
          onClose={() => setDrop(null)}
          onDone={load}
        />
      )}

      {linkFor && (
        <LinkedTodoModal
          issueId={linkFor.id}
          issueTitle={linkFor.title}
          onClose={() => setLinkFor(null)}
          onDone={load}
        />
      )}
    </div>
  )
}

function Section({
  n, item, count, right, children,
}: {
  n: number
  item?: { label: string; minutes: number }
  count?: number
  right?: React.ReactNode
  children: React.ReactNode
}) {
  if (!item) return null
  return (
    <div className="card">
      <div className="card__head">
        <div className="l10sec">
          <span className="l10sec__n" aria-hidden="true">{n}</span>
          <h2>{item.label}</h2>
          <span className="l10sec__min">{item.minutes} min</span>
          {count !== undefined && <span className="faint mono">{count}</span>}
        </div>
        <div className="card__end">{right}</div>
      </div>
      <div className="card__body--flush">{children}</div>
    </div>
  )
}

function CompletionMeter({ done, total, pct, target }: { done: number; total: number; pct: number | null; target: number }) {
  const p = pct === null ? 0 : pct
  const hit = p >= target
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="bar" style={{ width: 96 }} role="img" aria-label={`${Math.round(p * 100)} percent complete`}>
        <span className={'bar__f' + (hit ? '' : ' bar__f--under')} style={{ width: `${Math.round(p * 100)}%` }} />
      </span>
      <span className="mono" style={{ fontSize: 12, fontWeight: 640, color: hit ? 'var(--green)' : 'var(--amber)' }}>
        {total ? Math.round(p * 100) : '–'}%
      </span>
      <span className="faint nowrap" style={{ fontSize: 11.5 }}>
        {done}/{total} · target {Math.round(target * 100)}%
      </span>
    </span>
  )
}

/*
 * In the meeting only THIS week's column is typed into, so the L10 shows the last
 * few periods for context and makes the current one the editable target.
 */
function ScorecardSection({
  scorecard, onSaved, onError, onDrop,
}: {
  scorecard: L10Data['scorecard']
  onSaved: () => void
  onError: (m: string) => void
  onDrop: (m: Measurable) => void
}) {
  if (scorecard.rows.length === 0) return <Empty title="No measurables yet" />
  const shown = scorecard.periods.slice(-5)

  return (
    <div className="gridwrap">
      <table className="grid">
        <thead>
          <tr>
            <th className="c-meas">Measurable</th>
            {shown.map(p => (
              <th key={p} title={p}>
                {shortPeriod(p)}
                {p === scorecard.currentPeriod && <div className="faint" style={{ fontSize: 9, fontWeight: 700 }}>NOW</div>}
              </th>
            ))}
            <th className="c-fill" aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {scorecard.rows.map(row => (
            <tr key={row.id}>
              <th className="c-meas" scope="row">
                <div className="meas__title">
                  <span>{row.title}</span>
                  {row.escalate && (
                    <button
                      className="badge-escalate"
                      onClick={() => onDrop(row)}
                      title="Three periods off goal — EOS says this belongs on the Issues list"
                    >
                      <span aria-hidden="true">▲</span> 3 red → drop
                    </button>
                  )}
                </div>
                <div className="meas__sub">
                  <Avatar name={row.ownerName} id={row.ownerId} sm />
                  <span className="meas__goal">{fmtGoal(row.goal, row.valueType)}</span>
                  <span style={{ marginLeft: 'auto' }}>
                    <RowMenu>{close => <button onClick={() => { close(); onDrop(row) }}>Drop to Issues</button>}</RowMenu>
                  </span>
                </div>
              </th>
              {shown.map(p => {
                const cell = row.cells.find(c => c.periodKey === p)
                if (!cell) return <td key={p} className="cell" />
                return (
                  <LiveCell
                    key={p}
                    measurableId={row.id}
                    cell={cell}
                    editable={p === scorecard.currentPeriod}
                    onSaved={onSaved}
                    onError={onError}
                  />
                )
              })}
              <td className="c-fill" aria-hidden="true" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LiveCell({
  measurableId, cell, editable, onSaved, onError,
}: {
  measurableId: string
  cell: Cell
  editable: boolean
  onSaved: () => void
  onError: (m: string) => void
}) {
  const [draft, setDraft] = useState(cell.value === null ? '' : String(cell.value))
  useEffect(() => { setDraft(cell.value === null ? '' : String(cell.value)) }, [cell.value])

  const mark = cellMark(cell.status)
  const cls = cellClass(cell.status) + (editable ? ' cell--now' : '')

  if (!editable) {
    return (
      <td className={cls}>
        {mark && <span className="cell__mark" aria-hidden="true">{mark}</span>}
        <div className="cell__in" aria-label={`${cell.periodKey}: ${cell.value ?? 'no value'}`}>
          {cell.value === null ? '' : cell.value}
        </div>
      </td>
    )
  }

  return (
    <td className={cls}>
      {mark && <span className="cell__mark" aria-hidden="true">{mark}</span>}
      <input
        className="cell__in"
        type="number"
        step="any"
        inputMode="decimal"
        value={draft}
        aria-label={`${cell.periodKey} value`}
        onChange={e => setDraft(e.target.value)}
        onBlur={async () => {
          const original = cell.value === null ? '' : String(cell.value)
          if (draft.trim() === original) return
          const parsed = draft.trim() === '' ? null : Number(draft)
          if (parsed !== null && !isFinite(parsed)) { setDraft(original); return }
          try { await setScore(measurableId, cell.periodKey, parsed); onSaved() }
          catch (e: any) { setDraft(original); onError(e.message) }
        }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      />
    </td>
  )
}

function RockLine({ rock, onSaved, onError, onDrop }: { rock: Rock; onSaved: () => void; onError: (m: string) => void; onDrop: () => void }) {
  const [busy, setBusy] = useState(false)
  const set = async (status: string) => {
    setBusy(true)
    try { await setRockStatus(rock.id, status, rock.rev); onSaved() }
    catch (e: any) { onError(e.message) }
    finally { setBusy(false) }
  }
  return (
    <div className="rowitem">
      <Avatar name={rock.ownerName} id={rock.ownerId} />
      <div className="rowitem__main">
        <div className="rowitem__title">
          {rock.title}
          {rock.companyRock && <span className="pill pill--muted">company</span>}
        </div>
        <div className="rowitem__meta">
          <span>{firstLast({ name: rock.ownerName }) || 'Unassigned'}</span>
          {rock.dueDate && <span className={dueClass(rock.dueDate, rock.status === 'done')}>due {fmtDate(rock.dueDate)}</span>}
          {rock.milestones.length > 0 && (
            <span className="mono">{rock.milestones.filter(m => m.done).length}/{rock.milestones.length} milestones</span>
          )}
        </div>
      </div>
      <div className="rowitem__end">
        {/* The owner declares it out loud — so both options are one click, and
            neither is inferred from milestone progress. */}
        <div className="seg" role="group" aria-label={`Status for ${rock.title}`}>
          <button aria-pressed={rock.status === 'on_track'} disabled={busy} onClick={() => set('on_track')}>On</button>
          <button aria-pressed={rock.status === 'off_track'} disabled={busy} onClick={() => set('off_track')}>Off</button>
          <button aria-pressed={rock.status === 'done'} disabled={busy} onClick={() => set('done')}>Done</button>
        </div>
        <RowMenu>{close => <button onClick={() => { close(); onDrop() }}>Drop to Issues</button>}</RowMenu>
      </div>
    </div>
  )
}

function HeadlineLine({ headline, onSaved, onError, onDrop }: { headline: Headline; onSaved: () => void; onError: (m: string) => void; onDrop: () => void }) {
  return (
    <div className="rowitem">
      <button
        className="check"
        aria-label="Mark read"
        title="Mark read — unread headlines roll into next week"
        onClick={async () => {
          try { await markHeadlineRead([headline.id]); onSaved() } catch (e: any) { onError(e.message) }
        }}
      >
        ✓
      </button>
      <div className="rowitem__main">
        <div className="rowitem__title">
          {headline.body}
          <span className={'pill ' + (headline.type === 'customer' ? 'pill--green' : 'pill--muted')}>
            <span className="pill__glyph" aria-hidden="true">{headline.type === 'customer' ? '★' : '◆'}</span>
            {headline.type}
          </span>
        </div>
        <div className="rowitem__meta"><span>{firstLast({ name: headline.createdByName })}</span></div>
      </div>
      <div className="rowitem__end">
        <RowMenu>{close => <button onClick={() => { close(); onDrop() }}>Drop to Issues</button>}</RowMenu>
      </div>
    </div>
  )
}

function TodoLine({ todo, onSaved, onError, onDrop }: { todo: Todo; onSaved: () => void; onError: (m: string) => void; onDrop: () => void }) {
  const isDone = todo.status === 'done'
  return (
    <div className={'rowitem' + (isDone ? ' rowitem--done' : '')}>
      <button
        className={'check' + (isDone ? ' check--on' : '')}
        aria-label={isDone ? 'Mark not done' : 'Mark done'}
        onClick={async () => {
          try { await setTodoStatus(todo.id, isDone ? 'open' : 'done', todo.rev); onSaved() }
          catch (e: any) { onError(e.message) }
        }}
      >
        ✓
      </button>
      <Avatar name={todo.ownerName} id={todo.ownerId} sm />
      <div className="rowitem__main">
        <div className="rowitem__title">{todo.title}</div>
        <div className="rowitem__meta">
          <span>{firstLast({ name: todo.ownerName }) || 'Unassigned'}</span>
          {todo.dueDate && <span className={dueClass(todo.dueDate, isDone)}>due {fmtDate(todo.dueDate)}</span>}
        </div>
      </div>
      <div className="rowitem__end">
        {/* Not done → recommit or drop to Issues. That choice is the whole point
            of reviewing the list. */}
        <RowMenu>{close => <button onClick={() => { close(); onDrop() }}>Not done → drop to Issues</button>}</RowMenu>
      </div>
    </div>
  )
}
