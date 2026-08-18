import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMy90, setTodoStatus, setRockStatus, saveMilestone } from '../api'
import type { My90 as My90Data } from '../api'
import { useApp } from '../state'
import {
  Avatar, Empty, ErrorBanner, Loading,
  cellClass, cellMark, dueClass, fmtDate, fmtGoal, plusDaysIso, shortPeriod,
} from '../lib/ui'
import { TodoRow } from './Todos'

/*
 * My 90 — the personal home page, and the only screen most people open daily.
 * Aggregates across every company the caller can see: my to-dos, my rocks and
 * milestones, and the measurables I own.
 */
export default function My90() {
  const { me, multiCompany } = useApp()
  const [data, setData] = useState<My90Data | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    setErr(null)
    getMy90().then(setData).catch(e => setErr(e.message))
  }, [])

  useEffect(() => { load() }, [load])

  const today = plusDaysIso(0)

  if (!data && !err) return <div className="page"><Loading what="Loading your 90" /></div>

  const openTodos = data ? data.todos.filter(t => t.status === 'open') : []
  const overdue = openTodos.filter(t => t.dueDate && t.dueDate < today)
  const offTrack = data ? data.rocks.filter(r => r.status === 'off_track') : []
  const redMeasurables = data
    ? data.measurables.filter(m => {
        const last = [...m.cells].reverse().find(c => c.status === 'green' || c.status === 'red')
        return last?.status === 'red'
      })
    : []

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1>My 90</h1>
          <div className="page__sub">
            Everything you're accountable for{multiCompany ? ', across every company you can see' : ''}.
          </div>
        </div>
      </div>

      <ErrorBanner error={err} onDismiss={() => setErr(null)} />

      {/* No staff record means ownerId can never match — say so plainly rather
          than showing a confusingly empty page. */}
      {data && !me.id && (
        <div className="banner banner--warn">
          <div>
            <div className="banner__b">Your login has no staff record in this organisation.</div>
            My 90 matches on the staff record that owns each item, so nothing can appear here. Everything
            else in Traction works normally.
          </div>
        </div>
      )}

      {data && (
        <>
          <div className="kpis" style={{ marginBottom: 14 }}>
            <div className="kpi">
              <div className="kpi__v">{openTodos.length}</div>
              <div className="kpi__l">Open to-dos</div>
            </div>
            <div className="kpi">
              <div className="kpi__v" style={{ color: overdue.length ? 'var(--red)' : undefined }}>{overdue.length}</div>
              <div className="kpi__l">Overdue</div>
            </div>
            <div className="kpi">
              <div className="kpi__v">{data.rocks.length}</div>
              <div className="kpi__l">My rocks</div>
            </div>
            <div className="kpi">
              <div className="kpi__v" style={{ color: offTrack.length ? 'var(--red)' : undefined }}>{offTrack.length}</div>
              <div className="kpi__l">Off track</div>
            </div>
            <div className="kpi">
              <div className="kpi__v">{data.measurables.length}</div>
              <div className="kpi__l">My numbers</div>
            </div>
            <div className="kpi">
              <div className="kpi__v" style={{ color: redMeasurables.length ? 'var(--red)' : undefined }}>{redMeasurables.length}</div>
              <div className="kpi__l">Latest red</div>
            </div>
          </div>

          <div className="card">
            <div className="card__head">
              <h2>My To-Dos</h2>
              <span className="card__end"><Link to="/todos" className="btn btn--sm">All to-dos</Link></span>
            </div>
            <div className="card__body--flush">
              {openTodos.length === 0 ? (
                <Empty title="Nothing on your list">Enjoy it, or go solve an issue.</Empty>
              ) : (
                <div className="rows">
                  {openTodos.map(t => (
                    <TodoRow
                      key={t.id}
                      todo={t}
                      showCompany
                      onToggle={async () => {
                        try { await setTodoStatus(t.id, 'done', t.rev); load() } catch (e: any) { setErr(e.message) }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card__head">
              <h2>My Rocks</h2>
              <span className="card__end"><Link to="/rocks" className="btn btn--sm">All rocks</Link></span>
            </div>
            <div className="card__body--flush">
              {data.rocks.length === 0 ? (
                <Empty title="You don't own a rock this quarter" />
              ) : (
                <div className="rows">
                  {data.rocks.map(r => (
                    <div className="rowitem" key={r.id}>
                      <Avatar name={r.ownerName} id={r.ownerId} sm />
                      <div className="rowitem__main">
                        <div className="rowitem__title">
                          {r.title}
                          {r.companyRock && <span className="pill pill--muted">company</span>}
                        </div>
                        <div className="rowitem__meta">
                          {r.dueDate && <span className={dueClass(r.dueDate, r.status === 'done')}>due {fmtDate(r.dueDate)}</span>}
                          {r.milestones.length > 0 && (
                            <span className="mono">{r.milestones.filter(m => m.done).length}/{r.milestones.length} milestones</span>
                          )}
                          {r.companyName && <span className="faint">{r.companyName}</span>}
                        </div>
                      </div>
                      <div className="rowitem__end">
                        <div className="seg" role="group" aria-label={`Status for ${r.title}`}>
                          <button aria-pressed={r.status === 'on_track'} onClick={async () => {
                            try { await setRockStatus(r.id, 'on_track', r.rev); load() } catch (e: any) { setErr(e.message) }
                          }}>On</button>
                          <button aria-pressed={r.status === 'off_track'} onClick={async () => {
                            try { await setRockStatus(r.id, 'off_track', r.rev); load() } catch (e: any) { setErr(e.message) }
                          }}>Off</button>
                          <button aria-pressed={r.status === 'done'} onClick={async () => {
                            try { await setRockStatus(r.id, 'done', r.rev); load() } catch (e: any) { setErr(e.message) }
                          }}>Done</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {data.milestones.length > 0 && (
            <div className="card">
              <div className="card__head"><h2>My open milestones</h2></div>
              <div className="card__body--flush">
                <div className="rows">
                  {data.milestones.map(m => (
                    <div className="rowitem" key={m.milestone.id}>
                      <button
                        className="check"
                        aria-label={`Mark "${m.milestone.title}" done`}
                        onClick={async () => {
                          try {
                            // rev is unknown here, so the write is sent without one
                            // and the server takes it as an opt-out of the check.
                            await saveMilestone(m.rockId, { id: m.milestone.id, done: true }, undefined as any)
                            load()
                          } catch (e: any) { setErr(e.message) }
                        }}
                      >
                        ✓
                      </button>
                      <div className="rowitem__main">
                        <div className="rowitem__title">{m.milestone.title}</div>
                        <div className="rowitem__meta">
                          <span className="faint">{m.rockTitle}</span>
                          {m.milestone.dueDate && (
                            <span className={dueClass(m.milestone.dueDate, m.milestone.done)}>due {fmtDate(m.milestone.dueDate)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card__head">
              <h2>Numbers I own</h2>
              <span className="card__end"><Link to="/scorecard" className="btn btn--sm">Scorecard</Link></span>
            </div>
            <div className="card__body--flush">
              {data.measurables.length === 0 ? (
                <Empty title="You don't own a measurable" />
              ) : (
                <div className="gridwrap">
                  <table className="grid">
                    <thead>
                      <tr>
                        <th className="c-meas">Measurable</th>
                        {data.measurables[0].cells.slice(-6).map(c => (
                          <th key={c.periodKey} title={c.periodKey}>{shortPeriod(c.periodKey)}</th>
                        ))}
                        <th className="c-fill" aria-hidden="true" />
                      </tr>
                    </thead>
                    <tbody>
                      {data.measurables.map(m => (
                        <tr key={m.id}>
                          <th className="c-meas" scope="row">
                            <div className="meas__title">
                              <span>{m.title}</span>
                              {m.escalate && <span className="badge-escalate"><span aria-hidden="true">▲</span> 3 red</span>}
                            </div>
                            <div className="meas__sub">
                              <span className="meas__goal">{fmtGoal(m.goal, m.valueType)}</span>
                              {m.companyName && <span className="faint" style={{ fontSize: 11 }}>{m.companyName}</span>}
                            </div>
                          </th>
                          {m.cells.slice(-6).map(c => (
                            <td key={c.periodKey} className={cellClass(c.status)}>
                              {cellMark(c.status) && <span className="cell__mark" aria-hidden="true">{cellMark(c.status)}</span>}
                              <div className="cell__in">{c.value === null ? '' : c.value}</div>
                            </td>
                          ))}
                          <td className="c-fill" aria-hidden="true" />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
