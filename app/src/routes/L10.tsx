import Scorecard from './Scorecard'
import Rocks from './Rocks'
import Todos from './Todos'
import Headlines from './Headlines'
import FollowupContext from '../meetings/FollowupContext'
import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { getL10 } from '../api'
import type { L10 as L10Data, Issue } from '../api'
import { useApp } from '../state'
import {
  Avatar, Empty, ErrorBanner, Loading,
} from '../lib/ui'
import { DropToIssueModal, LinkedTodoModal } from '../components/DropToIssue'

/* Team review data supports the lobby and the active live section. */
const ActiveReviewSection = createContext<{id:string;label?:string;number?:number} | undefined>(undefined)
const reviewSections = ['segue','scorecard','rocks','headlines','todos','ids','conclude']

export default function L10({embedded=false,section,sectionLabel,sectionNumber,companyId}:{embedded?:boolean;section?:string;sectionLabel?:string;sectionNumber?:number;companyId?:string}) {
  const { company, nameOf } = useApp()
  const [data, setData] = useState<L10Data | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [drop, setDrop] = useState<{ kind: string; id: string; label: string; title: string } | null>(null)
  const [linkFor, setLinkFor] = useState<Issue | null>(null)

  const load = useCallback(() => {
    setErr(null)
    getL10(companyId || company.id).then(setData).catch(e => setErr(e.message))
  }, [company.id,companyId])

  useEffect(() => { setData(null); load(); if (!embedded) return; const timer=window.setInterval(load,10000); return()=>window.clearInterval(timer) }, [load,embedded])

  if (!data && !err) return <div className="page"><Loading what="Loading the meeting" /></div>

  return (
    <div className={embedded ? 'meeting-review-lists' : 'page'}>
      {!embedded && <div className="page__head">
        <div>
          <h1>Level 10 — {data?.company.settings.displayName || company.name}</h1>
          <div className="page__sub">
            Week of {data?.weekLabel} · {data?.quarterKey} · everything here is live and editable
          </div>
        </div>
        <div className="page__actions">
          <button className="btn" onClick={load}>Refresh</button>
        </div>
      </div>}

      <ErrorBanner error={err} onDismiss={() => setErr(null)} />

      {data && (
        <>
          <ActiveReviewSection.Provider value={section ? {id:section,label:sectionLabel,number:sectionNumber} : undefined}><section aria-label={section ? 'Current meeting section' : 'Team scorecard and review lists'}>{!section && <h2>Team scorecard and review lists</h2>}
          <Section n={1} item={data.agenda[0]}>
            <div className="card__body">
              <p className="muted" style={{ margin: 0 }}>
                One personal and one professional good-news item from everyone. No business — this
                part is for the humans in the room.
              </p>
            </div>
          </Section>

          {/* Scorecard — read the numbers. Off track drops to Issues. No discussion. */}
          <Section n={2} item={data.agenda[1]} count={data.scorecard.rows.filter(row=>!!row.ownerId?.trim()).length}>
            <Scorecard embedded ownedOnly companyId={companyId||company.id}/>
          </Section>

          {/* Rock review — each owner says On Track or Off Track. No discussion. */}
          <Section n={3} item={data.agenda[2]} count={data.rocks.length}>
            <Rocks embedded companyId={companyId||company.id}/>
          </Section>

          {/* Headlines — unread only, so nothing is silently dropped. */}
          <Section n={4} item={data.agenda[3]} count={data.headlines.length}>
            <Headlines embedded companyId={companyId||company.id}/>
          </Section>

          {/* Action Items — last week's list. The 90% target is the one bit of meeting
              arithmetic nobody does by hand. */}
          <Section
            n={5}
            item={data.agenda[4]}
            right={<CompletionMeter done={data.todos.completed} total={data.todos.total} pct={data.todos.pct} target={data.todos.target} />}
          >
            <Todos embedded companyId={companyId||company.id}/>
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
                        {issue.title}<FollowupContext item={issue}/>
                        {issue.origin && issue.origin.kind !== 'manual' && (
                          <span className="pill pill--muted">from {issue.origin.kind}</span>
                        )}
                      </div>
                      {issue.description && <div className="rowitem__meta">{issue.description}</div>}
                    </div>
                    <div className="rowitem__end">
                      {issue.ownerId && <Avatar name={nameOf(issue.ownerId)} id={issue.ownerId} sm />}
                      <span className="mono faint">P{issue.priority ?? '–'}</span>
                      <button className="btn btn--sm" disabled={issue.readOnly} onClick={() => setLinkFor(issue)}>Solve → Action Item</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section n={7} item={data.agenda[6]}>
            <div className="card__body">
              <p className="muted" style={{ marginTop: 0 }}>
                Recap the Action Items created, confirm who is telling whom, and close.
              </p>
              <div className="kpis">
                <div className="kpi">
                  <div className="kpi__v">{data.issues.length}</div>
                  <div className="kpi__l">Issues still open</div>
                </div>
                <div className="kpi">
                  <div className="kpi__v">{data.todos.rows.filter(t => t.status === 'open').length}</div>
                  <div className="kpi__l">Action Items carried</div>
                </div>
                <div className="kpi">
                  <div className="kpi__v">{data.rocks.filter(r => r.status === 'off_track').length}</div>
                  <div className="kpi__l">Rocks off track</div>
                </div>
              </div>
            </div>
          </Section>
          </section></ActiveReviewSection.Provider>
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
  const active = useContext(ActiveReviewSection)
  if (!item || (active && reviewSections[n-1] !== active.id)) return null
  const label = active ? (active.label || {todos:'Action Items',ids:'Issues',conclude:'Conclusion'}[active.id] || item.label) : item.label
  return (
    <div className="card">
      <div className="card__head">
        <div className="l10sec">
          <span className="l10sec__n" aria-hidden="true">{active ? (active.number || ['segue','headlines','todos','scorecard','ids','conclude'].indexOf(active.id)+1) : n}</span>
          <h2>{label}</h2>
          {!active && <span className="l10sec__min">{item.minutes} min</span>}
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
