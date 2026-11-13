import {useTableColumns} from '../components/TableColumns'
import {useNameForSort} from '../lib/memberProfiles'
import {rockStatus} from '../rocks/model'
import {useToday} from '../lib/useToday'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMy90, setTodoStatus, setRockStatus, saveMilestone } from '../api'
import type { My90 as My90Data } from '../api'
import { useApp } from '../state'
import {
  Avatar, PersonName, Empty, ErrorBanner, Loading, StatusPill,
  cellClass, cellMark, dueClass, fmtDate, fmtGoal, shortPeriod,
} from '../lib/ui'

/*
 * My 90 — the personal home page, and the only screen most people open daily.
 * Aggregates across every company the caller can see: my action items, my rocks and
 * milestones, and the measurables I own.
 */
export default function My90() {
  const { me, multiCompany, teams } = useApp()
  const sortName=useNameForSort()
  const [data, setData] = useState<My90Data | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    setErr(null)
    getMy90().then(setData).catch(e => setErr(e.message))
  }, [])

  useEffect(() => { load() }, [load])

  const today = useToday()
  const rocks = (data?.rocks || []).map(rock => ({...rock, status: rockStatus(rock, today)}))


  const openTodos = data ? data.todos.filter(t => t.status === 'open') : []
  const overdue = openTodos.filter(t => t.dueDate && t.dueDate < today)
  const offTrack = data ? rocks.filter(r => r.status === 'off_track') : []
  const allRockMilestones=rocks.flatMap(rock=>rock.milestones)
  const completeMilestones=allRockMilestones.filter(milestone=>milestone.done).length
  const lateMilestones=allRockMilestones.filter(milestone=>!milestone.done&&milestone.dueDate&&milestone.dueDate<today).length

  const people=[...Object.values(teams||{}).flat(),me]
  const milestoneOwner=(m:My90Data['milestones'][number])=>people.find(person=>person.id===(m.milestone.ownerId||me.id))?.name||'Unassigned'
  const todoTable=useTableColumns(openTodos,[
    {key:'owner',label:'Owner',kind:'select',value:t=>sortName(t.ownerId,t.ownerName)},
    {key:'due',label:'Due date',kind:'date',value:t=>t.dueDate},
    {key:'team',label:'Team',kind:'select',value:t=>t.companyName||'Unassigned'},
    {key:'title',label:'Action Item',value:t=>t.title},
  ],'My Action Items')
  const rockTable=useTableColumns(rocks,[
    {key:'owner',label:'Owner',kind:'select',value:r=>sortName(r.ownerId,r.ownerName)},
    {key:'due',label:'Due date',kind:'date',value:r=>r.dueDate},
    {key:'team',label:'Team',kind:'select',value:r=>r.companyName||'Unassigned'},
    {key:'title',label:'Rock',value:r=>r.title},
    {key:'milestones',label:'Milestones',kind:'select',value:r=>r.milestones.length?r.milestones.filter(m=>m.done).length/r.milestones.length:null,options:[{value:'overdue',label:'Has overdue milestones'},{value:'incomplete',label:'Has incomplete milestones'},{value:'complete',label:'All milestones complete'},{value:'none',label:'No milestones'}],matches:(r,filter)=>filter==='none'?r.milestones.length===0:filter==='complete'?r.milestones.length>0&&r.milestones.every(m=>m.done):filter==='overdue'?r.milestones.some(m=>!m.done&&!!m.dueDate&&m.dueDate<today):r.milestones.some(m=>!m.done)},
    {key:'status',label:'Status',kind:'select',value:r=>({off_track:0,on_track:1,done:2}[r.status]??3),filterValue:r=>r.status,options:[{value:'off_track',label:'Off Track'},{value:'on_track',label:'On Track'},{value:'done',label:'Done'}]},
  ],'My Rocks')
  const milestoneTable=useTableColumns(data?.milestones||[],[
    {key:'owner',label:'Owner',kind:'select',value:m=>sortName(m.milestone.ownerId||me.id,milestoneOwner(m))},
    {key:'due',label:'Due date',kind:'date',value:m=>m.milestone.dueDate},
    {key:'team',label:'Team',kind:'select',value:m=>m.companyName||'Unassigned'},
    {key:'title',label:'Milestone',value:m=>m.milestone.title},
    {key:'rock',label:'Rock',value:m=>m.rockTitle},
  ],'My open milestones')

  if (!data && !err) return <div className="page"><Loading what="Loading your dashboard" /></div>

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1>My Dashboard</h1>
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
            else in TenK works normally.
          </div>
        </div>
      )}

      {data && (
        <>
          <div className="dashboard-summaries">
            <section className="card card__body" aria-label="Action item summary"><h2>My Action Items</h2><div className="dashboard-summary__value">{openTodos.length} <span>open</span></div><p className="muted">{overdue.length} of these are overdue</p><Link to="/todos">View action items →</Link></section>
            <section className="card card__body" aria-label="Rock summary"><h2>My Rocks</h2><div className="dashboard-summary__value">{rocks.length} <span>Rocks</span></div><p className="muted">{offTrack.length} off track · {rocks.filter(rock=>rock.status==='done').length} complete</p><p>{completeMilestones} of {allRockMilestones.length} milestones complete · <span title="Incomplete milestones with a due date before today">{lateMilestones} overdue</span></p><Link to="/rocks">View Rocks →</Link></section>
            <section className="card card__body" aria-label="Scorecard summary"><h2>My Scorecard Numbers</h2><div className="dashboard-summary__value">{data.measurables.length} <span>numbers</span></div><p className="muted">Measurables you own</p><Link to="/scorecard">View scorecard →</Link></section>
          </div>

          <div className="card">
            <div className="card__head">
              <h2>My Action Items</h2>
              <span className="card__end"><Link to="/todos" className="btn btn--sm">All action items</Link></span>
            </div>
            <div className="card__body--flush">
              {todoTable.summary}
              {openTodos.length === 0 ? (
                <Empty title="Nothing on your list">Enjoy it, or go solve an issue.</Empty>
              ) : (
                <div className="dashboard-action-table" role="table" aria-label="My Action Items">
                  <div className="dashboard-action-row dashboard-action-row--head" role="row"><span/>{['owner','due','team','title'].map(key=><span key={key} role="columnheader" aria-sort={todoTable.ariaSort(key)}>{todoTable.header(key)}</span>)}</div>
                  {todoTable.rows.map(todo=><div role="row" key={todo.id} className={'dashboard-action-row'+(todo.dueDate&&todo.dueDate<today?' action-item-row--overdue':'')}>
                    <button className="check" aria-label={`Mark "${todo.title}" done`} onClick={async()=>{try{await setTodoStatus(todo.id,'done',todo.rev);load()}catch(error){setErr((error as Error).message)}}}>✓</button>
                    <span role="cell" className="dashboard-action-owner"><Avatar name={todo.ownerName} id={todo.ownerId} sm/><PersonName name={todo.ownerName} id={todo.ownerId}/></span>
                    <span role="cell" className={dueClass(todo.dueDate,false)}>{todo.dueDate?fmtDate(todo.dueDate):'—'}</span>
                    <span role="cell" className="dashboard-action-team" title={todo.companyName}>{todo.companyName||'—'}</span>
                    <span role="cell" className="dashboard-action-title" title={todo.title}>{todo.title}</span>
                  </div>)}
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
              {rockTable.summary}
              {data.rocks.length === 0 ? (
                <Empty title="You don't own a rock this quarter" />
              ) : (
                <div className="dashboard-action-table" role="table" aria-label="My Rocks">
                  <div className="dashboard-action-row dashboard-rock-row dashboard-action-row--head" role="row">{['owner','due','team','title','milestones','status'].map(key=><span key={key} role="columnheader" aria-sort={rockTable.ariaSort(key)}>{rockTable.header(key)}</span>)}</div>
                  {rockTable.rows.map(r => (
                    <div className="dashboard-action-row dashboard-rock-row" role="row" key={r.id}>
                      <span role="cell" className="dashboard-action-owner"><Avatar name={r.ownerName} id={r.ownerId} sm/><PersonName name={r.ownerName} id={r.ownerId}/></span>
                      <span role="cell" className={dueClass(r.dueDate,r.status==='done')}>{r.dueDate?fmtDate(r.dueDate):'—'}</span>
                      <span role="cell" className="dashboard-action-team" title={r.companyName}>{r.companyName||'—'}</span>
                      <span role="cell" className="dashboard-action-title" title={r.title}>{r.title}</span>
                      <span role="cell" title={`${r.milestones.filter(m=>m.done).length} of ${r.milestones.length} complete; ${r.milestones.filter(m=>!m.done&&m.dueDate&&m.dueDate<today).length} overdue`}>{r.milestones.filter(m=>m.done).length}/{r.milestones.length} complete · {r.milestones.filter(m=>!m.done&&m.dueDate&&m.dueDate<today).length} overdue</span>
                      <div role="cell" className="rowitem__end">
                        {r.milestones.length > 0 ? <StatusPill status={r.status}/> : <div className="seg" role="group" aria-label={`Status for ${r.title}`}>
                          <button aria-pressed={r.status === 'on_track'} onClick={async () => {
                            try { await setRockStatus(r.id, 'on_track', r.rev); load() } catch (e: any) { setErr(e.message) }
                          }}>On</button>
                          <button aria-pressed={r.status === 'off_track'} onClick={async () => {
                            try { await setRockStatus(r.id, 'off_track', r.rev); load() } catch (e: any) { setErr(e.message) }
                          }}>Off</button>
                          <button aria-pressed={r.status === 'done'} onClick={async () => {
                            try { await setRockStatus(r.id, 'done', r.rev); load() } catch (e: any) { setErr(e.message) }
                          }}>Done</button>
                        </div>}
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
                {milestoneTable.summary}<div className="dashboard-action-table" role="table" aria-label="My open milestones">
                  <div className="dashboard-action-row dashboard-milestone-row dashboard-action-row--head" role="row"><span/>{['owner','due','team','title','rock'].map(key=><span key={key} role="columnheader" aria-sort={milestoneTable.ariaSort(key)}>{milestoneTable.header(key)}</span>)}</div>
                  {milestoneTable.rows.map(m => (
                    <div className="dashboard-action-row dashboard-milestone-row" role="row" key={m.milestone.id}>
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
                      <span role="cell" className="dashboard-action-owner"><Avatar name={milestoneOwner(m)} id={m.milestone.ownerId||me.id} sm/><PersonName name={milestoneOwner(m)} id={m.milestone.ownerId||me.id}/></span>
                      <span role="cell" className={dueClass(m.milestone.dueDate,m.milestone.done)}>{m.milestone.dueDate?fmtDate(m.milestone.dueDate):'—'}</span>
                      <span role="cell" className="dashboard-action-team" title={m.companyName}>{m.companyName||'—'}</span>
                      <span role="cell" className="dashboard-action-title" title={m.milestone.title}>{m.milestone.title}</span>
                      <span role="cell" className="dashboard-action-title muted" title={m.rockTitle}>{m.rockTitle}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card__head">
              <h2>My Scorecard Numbers</h2>
              <span className="card__end"><Link to="/scorecard" className="btn btn--sm">Scorecard</Link></span>
            </div>
            <div className="card__body--flush">
              {data.measurables.length === 0 ? (
                <Empty title="You don't own a measurable" />
              ) : (
                <div className="gridwrap">
                  <table className="grid dashboard-scorecard">
                    <thead>
                      <tr>
                        <th className="c-meas">Measurable</th><th>Team</th><th>Goal</th>
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
                            <div className="dashboard-action-title" title={m.title}>{m.title}</div>
                          </th>
                          <td className="dashboard-scorecard-team" title={m.companyName}>{m.companyName||'—'}</td>
                          <td className="dashboard-scorecard-goal">{fmtGoal(m.goal,m.valueType)}</td>
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
