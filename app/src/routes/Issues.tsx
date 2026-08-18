import { useCallback, useEffect, useRef, useState } from 'react'
import { getIssues, saveIssue, rankIssues, solveIssue, archiveIssues } from '../api'
import type { Issue } from '../api'
import { useApp } from '../state'
import {
  Avatar, Empty, ErrorBanner, Loading, Modal, OwnerPicker, RowMenu,
  fmtDate, firstLast,
} from '../lib/ui'
import { LinkedTodoModal } from '../components/DropToIssue'

/*
 * A ranked list you can drag. Short-term is what the weekly L10 works through;
 * long-term is the parking lot that feeds future Rocks.
 *
 * IDS — Identify, Discuss, Solve — is a discipline, not a data structure. What
 * the software owes it is: an order, and a solve action whose output is a To-Do.
 */
export default function Issues() {
  const { company, team, me, nameOf } = useApp()
  const [term, setTerm] = useState<'short' | 'long'>('short')
  const [showSolved, setShowSolved] = useState(false)
  const [rows, setRows] = useState<Issue[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<Issue | 'new' | null>(null)
  const [solving, setSolving] = useState<Issue | null>(null)
  const [linkFor, setLinkFor] = useState<Issue | null>(null)
  const dragId = useRef<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const load = useCallback(() => {
    setErr(null)
    getIssues(company.id, term, showSolved ? undefined : 'open')
      .then(r => setRows(r.rows))
      .catch(e => setErr(e.message))
  }, [company.id, term, showSolved])

  useEffect(() => { setRows(null); load() }, [load])

  const onDrop = async (targetId: string) => {
    const from = dragId.current
    dragId.current = null
    setOverId(null)
    if (!from || !rows || from === targetId) return
    const ids = rows.map(r => r.id)
    const fi = ids.indexOf(from), ti = ids.indexOf(targetId)
    if (fi < 0 || ti < 0) return
    ids.splice(ti, 0, ids.splice(fi, 1)[0])
    // Optimistic: reorder locally, then let the server confirm.
    setRows(ids.map(id => rows.find(r => r.id === id)!).filter(Boolean))
    try { await rankIssues(ids); load() } catch (e: any) { setErr(e.message); load() }
  }

  const solvedCount = rows ? rows.filter(r => r.status === 'solved').length : 0

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1>Issues</h1>
          <div className="page__sub">
            Ranked highest first. Drag to reorder — the top of this list is what the L10 works on.
          </div>
        </div>
        <div className="page__actions">
          <div className="seg" role="group" aria-label="Term">
            <button aria-pressed={term === 'short'} onClick={() => setTerm('short')}>Short-term</button>
            <button aria-pressed={term === 'long'} onClick={() => setTerm('long')}>Long-term</button>
          </div>
          <button className="btn" aria-pressed={showSolved} onClick={() => setShowSolved(s => !s)}>
            {showSolved ? 'Hide solved' : 'Show solved'}
          </button>
          {showSolved && solvedCount > 0 && (
            <button
              className="btn"
              onClick={async () => {
                const ids = rows!.filter(r => r.status === 'solved').map(r => r.id)
                if (!confirm(`Archive ${ids.length} solved issue${ids.length > 1 ? 's' : ''}? The record is kept.`)) return
                try { await archiveIssues(ids); load() } catch (e: any) { setErr(e.message) }
              }}
            >
              Archive solved ({solvedCount})
            </button>
          )}
          <button className="btn btn--primary" onClick={() => setEditing('new')}>+ Issue</button>
        </div>
      </div>

      <ErrorBanner error={err} onDismiss={() => setErr(null)} />

      {!rows ? (
        <Loading what="Loading issues" />
      ) : rows.length === 0 ? (
        <div className="card">
          <Empty title={term === 'short' ? 'No open short-term issues' : 'No long-term issues'}>
            {term === 'short'
              ? 'Anything that needs discussing belongs here. Most get here by being dropped from the scorecard, a rock or a headline.'
              : 'The parking lot. Long-term issues are where next quarter’s Rocks come from.'}
          </Empty>
        </div>
      ) : (
        <div className="card card__body--flush">
          <div className="rows">
            {rows.map((issue, i) => (
              <div
                key={issue.id}
                className={'rowitem' + (overId === issue.id ? ' rowitem--dragover' : '') + (issue.status === 'solved' ? ' rowitem--done' : '')}
                draggable
                onDragStart={() => { dragId.current = issue.id }}
                onDragOver={e => { e.preventDefault(); setOverId(issue.id) }}
                onDragLeave={() => setOverId(o => (o === issue.id ? null : o))}
                onDrop={e => { e.preventDefault(); onDrop(issue.id) }}
              >
                <span className="rowitem__grip" aria-hidden="true" title="Drag to reorder">⋮⋮</span>
                <span className={'rank' + (i < 3 && issue.status === 'open' ? ' rank--top' : '')} title={`Rank ${i + 1}`}>
                  {i + 1}
                </span>
                <div className="rowitem__main">
                  <div className="rowitem__title">
                    {issue.title}
                    {issue.origin && issue.origin.kind !== 'manual' && (
                      <span className="pill pill--muted" title={issue.origin.label}>
                        from {issue.origin.kind}
                      </span>
                    )}
                    {issue.status === 'solved' && <span className="pill pill--green"><span className="pill__glyph" aria-hidden="true">✓</span>solved</span>}
                  </div>
                  <div className="rowitem__meta">
                    <span className="mono">P{issue.priority ?? '–'}</span>
                    {issue.createdByName && <span>{firstLast({ name: issue.createdByName })}</span>}
                    {issue.createdDate && <span>{fmtDate(issue.createdDate)}</span>}
                    {issue.linkedTodoIds.length > 0 && (
                      <span>{issue.linkedTodoIds.length} linked to-do{issue.linkedTodoIds.length > 1 ? 's' : ''}</span>
                    )}
                  </div>
                  {issue.description && (
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{issue.description}</div>
                  )}
                  {issue.solution && (
                    <div style={{ fontSize: 12.5, marginTop: 4, color: 'var(--green)' }}>
                      <strong>Solved:</strong> {issue.solution}
                    </div>
                  )}
                </div>
                <div className="rowitem__end">
                  {issue.ownerId && <Avatar name={nameOf(issue.ownerId)} id={issue.ownerId} sm />}
                  {issue.status === 'open' && (
                    <button className="btn btn--sm" onClick={() => setSolving(issue)}>Solve</button>
                  )}
                  <RowMenu>
                    {close => (
                      <>
                        <button onClick={() => { close(); setEditing(issue) }}>Edit issue</button>
                        <button onClick={() => { close(); setLinkFor(issue) }}>Create linked To-Do</button>
                        <button
                          onClick={async () => {
                            close()
                            const nextTerm = issue.term === 'short' ? 'long' : 'short'
                            try { await saveIssue({ companyId: company.id, id: issue.id, title: issue.title, term: nextTerm, rev: issue.rev }); load() }
                            catch (e: any) { setErr(e.message) }
                          }}
                        >
                          Move to {issue.term === 'short' ? 'long-term' : 'short-term'}
                        </button>
                        <hr />
                        <button
                          onClick={async () => {
                            close()
                            if (!confirm('Archive this issue? The record is kept.')) return
                            try { await archiveIssues([issue.id]); load() } catch (e: any) { setErr(e.message) }
                          }}
                        >
                          Archive
                        </button>
                      </>
                    )}
                  </RowMenu>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <IssueModal
          initial={editing === 'new' ? null : editing}
          companyId={company.id}
          team={team}
          term={term}
          defaultOwnerId={me.id}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}

      {solving && (
        <SolveModal issue={solving} onClose={() => setSolving(null)} onSolved={() => { setSolving(null); load() }} />
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

function IssueModal({
  initial, companyId, team, term, defaultOwnerId, onClose, onSaved,
}: {
  initial: Issue | null
  companyId: string
  team: any[]
  term: 'short' | 'long'
  defaultOwnerId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(initial?.title || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [issueTerm, setIssueTerm] = useState(initial?.term || term)
  const [priority, setPriority] = useState(initial?.priority ?? 3)
  const [ownerId, setOwnerId] = useState(initial?.ownerId || defaultOwnerId || '')
  const [ownerName, setOwnerName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!title.trim()) { setErr('An issue needs a title.'); return }
    setBusy(true); setErr(null)
    try {
      await saveIssue({
        companyId, id: initial?.id, rev: initial?.rev,
        title: title.trim(), description, term: issueTerm, priority, ownerId, ownerName,
      })
      onSaved()
    } catch (e: any) {
      setErr(e.message || 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={initial ? 'Edit issue' : 'New issue'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn--primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      <ErrorBanner error={err} onDismiss={() => setErr(null)} />
      <div className="field">
        <label htmlFor="i-title">Issue</label>
        <input id="i-title" className="input" value={title} autoFocus onChange={e => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="i-desc">Context <span className="faint">(optional)</span></label>
        <textarea id="i-desc" className="textarea" value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      <div className="row3">
        <div className="field">
          <label htmlFor="i-term">List</label>
          <select id="i-term" className="select" value={issueTerm} onChange={e => setIssueTerm(e.target.value as any)}>
            <option value="short">Short-term</option>
            <option value="long">Long-term</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="i-pri">Priority</label>
          <select id="i-pri" className="select" value={priority} onChange={e => setPriority(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Owner</label>
          <OwnerPicker team={team} value={ownerId} valueName={ownerName} onChange={(id, n) => { setOwnerId(id); setOwnerName(n) }} />
        </div>
      </div>
    </Modal>
  )
}

function SolveModal({ issue, onClose, onSolved }: { issue: Issue; onClose: () => void; onSolved: () => void }) {
  const [solution, setSolution] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [thenTodo, setThenTodo] = useState(true)
  const [solved, setSolved] = useState(false)

  const submit = async () => {
    setBusy(true); setErr(null)
    try {
      await solveIssue(issue.id, solution.trim(), issue.rev)
      if (thenTodo) setSolved(true)
      else { onSolved(); }
    } catch (e: any) {
      setErr(e.message); setBusy(false)
    }
  }

  if (solved) {
    return (
      <LinkedTodoModal
        issueId={issue.id}
        issueTitle={issue.title}
        onClose={() => { onSolved() }}
        onDone={() => { /* onClose handles the refresh */ }}
      />
    )
  }

  return (
    <Modal
      title="Solve this issue"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn--primary" onClick={submit} disabled={busy}>
            {busy ? 'Solving…' : thenTodo ? 'Solve, then add a To-Do' : 'Mark solved'}
          </button>
        </>
      }
    >
      <ErrorBanner error={err} onDismiss={() => setErr(null)} />
      <div className="field">
        <label htmlFor="s-sol">{issue.title}</label>
        <textarea
          id="s-sol" className="textarea" autoFocus value={solution}
          onChange={e => setSolution(e.target.value)}
          placeholder="What was the root cause, and what did you decide?"
        />
        <div className="field__hint">Discuss once, get to the root cause, end with an owner and an action.</div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={thenTodo} onChange={e => setThenTodo(e.target.checked)} />
        Create a linked To-Do — a solved issue almost always has one
      </label>
    </Modal>
  )
}
