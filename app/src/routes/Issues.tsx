import {compareNames, compareDates, priorityLabel, priorityLabels} from '../lib/listModel'
import FollowupContext from '../meetings/FollowupContext'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
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
  const {company,team,me,nameOf,companies,meetingWorkflow}=useApp()
  const [assignedTeam,setAssignedTeam]=useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [inlineId, setInlineId] = useState<string | null>(null)
  const [sort, setSort] = useState('manual')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const ownerName = (issue: Issue) => firstLast({name: issue.ownerName || nameOf(issue.ownerId)})
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
    if (sort !== 'manual' || !from || !rows || from === targetId || rows.find(r=>r.id===targetId)?.readOnly) return
    const ids = rows.filter(r=>!r.readOnly).map(r => r.id)
    const fi = ids.indexOf(from), ti = ids.indexOf(targetId)
    if (fi < 0 || ti < 0) return
    ids.splice(ti, 0, ids.splice(fi, 1)[0])
    // Optimistic: reorder locally, then let the server confirm.
    let index = 0
    setRows(rows.map(row => row.readOnly ? row : rows.find(item => item.id === ids[index++])!))
    try { await rankIssues(ids); load() } catch (e: any) { setErr(e.message); load() }
  }

  const visible = (rows || []).filter(issue => (!ownerFilter || (ownerFilter === 'unassigned' ? !issue.ownerId : issue.ownerId === ownerFilter)) && (!assignedTeam || (assignedTeam === 'unassigned' ? !issue.responsibleTeamId : issue.responsibleTeamId === assignedTeam))).sort((a, b) => {
    if (sort === 'owner') return compareNames(ownerName(a), ownerName(b))
    if (sort === 'topic') return a.title.localeCompare(b.title, undefined, {sensitivity: 'base'})
    if (sort === 'topic-desc') return b.title.localeCompare(a.title, undefined, {sensitivity: 'base'})
    if (sort === 'owner-desc') return compareNames(ownerName(b), ownerName(a))
    if (sort === 'newest' || sort === 'oldest') return compareDates(a.createdDate, b.createdDate, sort === 'newest')
    return 0
  })

  const solvedCount = rows ? rows.filter(r => r.status === 'solved').length : 0

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <div className="issues-heading"><h1>Issues</h1><p className="ids-guide">IDS: Identify the root issue · Discuss openly · Solve with an action and owner.</p></div>
          <div className="page__sub">
            Ranked highest first. Drag to reorder — the top of this list is what the L10 works on.
          </div>
        </div>
        <div className="page__actions">          <div className="seg" role="group" aria-label="Term">
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
                const ids = rows!.filter(r => !r.readOnly&&r.status === 'solved').map(r => r.id)
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

      <div className="list-toolbar" aria-label="Issue filters and sorting">
        <label className="sort-control">Person<select className="select" value={ownerFilter} onChange={event => setOwnerFilter(event.target.value)}><option value="">All people</option><option value="unassigned">Unassigned</option>{[...new Map((rows || []).filter(issue => issue.ownerId).map(issue => [issue.ownerId, ownerName(issue) || 'Assigned person'])).entries()].sort((a,b) => compareNames(a[1],b[1])).map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
<label className="sort-control">Sort issues<select className="select" value={sort} onChange={event => setSort(event.target.value)}><option value="manual">Manual order</option><option value="owner">Owner A–Z</option><option value="owner-desc">Owner Z–A</option><option value="topic">Topic A–Z</option><option value="topic-desc">Topic Z–A</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>{meetingWorkflow&&<label>Responsible team<select className="select" value={assignedTeam} onChange={e=>setAssignedTeam(e.target.value)}><option value="">All responsible teams</option><option value="unassigned">No team assigned</option>{companies.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}</select></label>}

      </div>

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
            {visible.length === 0 && <Empty title="No issues match this filter"/>}
            {visible.map(issue => (
              <div
                key={issue.id}
                className={'rowitem' + (overId === issue.id ? ' rowitem--dragover' : '') + (issue.status === 'solved' ? ' rowitem--done' : '')}
                draggable={!issue.readOnly && sort === 'manual' && inlineId !== issue.id}
                onDragStart={() => { dragId.current = issue.id }}
                onDragOver={e => { e.preventDefault(); setOverId(issue.id) }}
                onDragLeave={() => setOverId(o => (o === issue.id ? null : o))}
                onDrop={e => { e.preventDefault(); onDrop(issue.id) }}
              >
                {sort === 'manual' && <span className="rowitem__grip" aria-hidden="true" title="Drag to reorder">⋮⋮</span>}
                <div className="rowitem__owner"><Avatar name={ownerName(issue)} id={issue.ownerId} sm/><span>{ownerName(issue) || 'Unassigned'}</span></div>
                <IssuePriority issue={issue} companyId={company.id} disabled={inlineId === issue.id} onSaved={load}/>

                <div className="rowitem__main">
                  {inlineId === issue.id && !issue.readOnly ? <IssueInlineEditor issue={issue} companyId={company.id} team={team} onCancel={() => setInlineId(null)} onSaved={() => {setInlineId(null); load()}}/> : <>
                  <div className="rowitem__title">
                    {issue.readOnly ? issue.title : <button type="button" className="rowitem__title-link" aria-label={`Edit issue ${issue.title}`} onClick={() => setInlineId(issue.id)}>{issue.title}</button>}<FollowupContext hideOwner item={issue}/>
                    {issue.origin && issue.origin.kind !== 'manual' && (
                      <span className="pill pill--muted" title={issue.origin.label}>
                        from {issue.origin.kind}
                      </span>
                    )}
                    {issue.status === 'solved' && <span className="pill pill--green"><span className="pill__glyph" aria-hidden="true">✓</span>solved</span>}
                  </div>
                  <div className="rowitem__meta">
                    <span className="mono">Importance: {priorityLabel(issue.priority)}</span>
                    {issue.createdByName && <span>{firstLast({ name: issue.createdByName })}</span>}
                    {issue.createdDate && <span>{fmtDate(issue.createdDate)}</span>}
                    {issue.linkedTodoIds.length > 0 && (
                      <span>{issue.linkedTodoIds.length} linked to-do{issue.linkedTodoIds.length > 1 ? 's' : ''}</span>
                    )}
                  </div>

                  <div id={`issue-details-${issue.id}`} hidden={!expanded.has(issue.id)}>
                  {issue.description && (
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{issue.description}</div>
                  )}
                  {issue.solution && (
                    <div style={{ fontSize: 12.5, marginTop: 4, color: 'var(--green)' }}>
                      <strong>Solved:</strong> {issue.solution}
                    </div>
                  )}
                  </div>
                  </>}
                </div>
                <div className="rowitem__end issue-actions">
                  {inlineId !== issue.id && (issue.description || issue.solution) && <button className="detail-toggle" aria-expanded={expanded.has(issue.id)} aria-controls={`issue-details-${issue.id}`} onClick={() => setExpanded(current => {const next = new Set(current); if (next.has(issue.id)) next.delete(issue.id); else next.add(issue.id); return next})}>{expanded.has(issue.id) ? 'Hide details' : 'Show details'}</button>}
                {!issue.readOnly && <>

                  {issue.status === 'open' && (
                    <button className="btn btn--sm" onClick={() => setSolving(issue)}>Solved</button>
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
                </>}
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

export function IssuePriority({issue, companyId, disabled, onSaved}: {issue: Issue; companyId: string; disabled?: boolean; onSaved: () => void}) {
  const [value, setValue] = useState(issue.priority === null ? '' : String(issue.priority))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const errorId = useId()
  useEffect(() => {setValue(issue.priority === null ? '' : String(issue.priority))}, [issue.priority, issue.rev])
  async function save(next: string) {
    if (busy || disabled || issue.readOnly) return
    setValue(next); setBusy(true); setError('')
    try {
      await saveIssue({companyId, id: issue.id, rev: issue.rev, title: issue.title, priority: Number(next)})
      onSaved()
    } catch (error: unknown) {
      setValue(issue.priority === null ? '' : String(issue.priority))
      setError(error instanceof Error ? error.message : 'Could not save the ranking.')
    } finally {setBusy(false)}
  }
  return <div className="issue-priority" onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} onDragStart={event => {event.preventDefault(); event.stopPropagation()}}>
    <select className={'rank rank-select' + (Number(value) >= 4 ? ' rank--top' : '')} aria-label={`Ranking for ${issue.title}`} aria-describedby={error ? errorId : undefined} aria-busy={busy} title={`Importance: ${priorityLabel(value ? Number(value) : null)} (1 lowest, 5 highest)`} value={value} disabled={busy || disabled || issue.readOnly} onChange={event => {void save(event.target.value)}}>
      {value === '' && <option value="" disabled>–</option>}
      {[1,2,3,4,5].map(rank => <option value={rank} key={rank}>{priorityLabels[rank]}</option>)}
    </select>
    {error && <span id={errorId} className="issue-priority__error" role="alert">{error}</span>}
  </div>
}

export function IssueInlineEditor({issue, companyId, team, onCancel, onSaved}: {issue: Issue; companyId: string; team: any[]; onCancel: () => void; onSaved: () => void}) {
  const [title, setTitle] = useState(issue.title)
  const [description, setDescription] = useState(issue.description)
  const [priority, setPriority] = useState(issue.priority ?? 3)
  const [ownerId, setOwnerId] = useState(issue.ownerId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function save() {
    if (!title.trim()) {setError('Enter an issue title.'); return}
    setBusy(true); setError(null)
    try {await saveIssue({companyId, id: issue.id, rev: issue.rev, title: title.trim(), description, priority, ownerId}); onSaved()}
    catch (error: unknown) {setError(error instanceof Error ? error.message : 'Could not save the issue.')}
    finally {setBusy(false)}
  }
  return <form className="inline-issue-editor" aria-label="Edit issue inline" onSubmit={event => {event.preventDefault(); void save()}} onKeyDown={event => {if (event.key === 'Escape' && !busy) {event.stopPropagation(); onCancel()}}}>
    <ErrorBanner error={error}/>
    <fieldset className="edit-fields" disabled={busy}>
    <label>Issue title<input className="input" autoFocus value={title} disabled={busy} onChange={event => setTitle(event.target.value)}/></label>
    <label>Issue notes<textarea className="textarea" value={description} disabled={busy} onChange={event => setDescription(event.target.value)}/></label>
    <div className="inline-editor-fields"><label>Importance<select className="select" value={priority} disabled={busy} onChange={event => setPriority(Number(event.target.value))}>{[1,2,3,4,5].map(value => <option key={value} value={value}>{priorityLabels[value]}</option>)}</select></label><label>Owner<OwnerPicker team={team} value={ownerId} valueName={issue.ownerName || ''} onChange={id => {if (!busy) setOwnerId(id)}}/></label></div>
    </fieldset><div className="inline-editor-actions"><button type="submit" className="btn btn--sm btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Save issue'}</button><button type="button" className="btn btn--sm" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </form>
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
  const {companies,meetingWorkflow}=useApp()
  const [responsibleTeamId,setResponsibleTeam]=useState(initial?.responsibleTeamId??'')
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
        title: title.trim(), description, term: issueTerm, priority, ownerId, ownerName,...(meetingWorkflow?{responsibleTeamId}:{}),
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
          <label htmlFor="i-pri">Importance (1 lowest, 5 highest)</label>
          <select id="i-pri" className="select" value={priority} onChange={e => setPriority(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{priorityLabels[n]}</option>)}
          </select>
        </div>
        <div className="field">
          {meetingWorkflow&&<label>Responsible team<select className="select" value={responsibleTeamId} onChange={e=>setResponsibleTeam(e.target.value)}><option value="">No team assigned</option>{companies.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}</select></label>}
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
