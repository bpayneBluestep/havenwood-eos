import { useCallback, useEffect, useState } from 'react'
import { getTodos, saveTodo, setTodoStatus } from '../api'
import type { Todo } from '../api'
import { useApp } from '../state'
import {
  Avatar, Empty, ErrorBanner, Loading, Modal, OwnerPicker, RowMenu,
  dueClass, fmtDate, firstLast, plusDaysIso,
} from '../lib/ui'
import { DropToIssueModal } from '../components/DropToIssue'

/*
 * Seven-day action items. The server owns the +7 default, because that horizon is
 * doctrine rather than a preference — anything longer should be a Rock or a
 * milestone, and the default is where that discipline gets enforced.
 *
 * Personal to-dos are private to their owner and never appear in the L10.
 */
export default function Todos() {
  const { company, team, me } = useApp()
  const [mine, setMine] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [rows, setRows] = useState<Todo[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<Todo | 'new' | null>(null)
  const [dropFor, setDropFor] = useState<Todo | null>(null)

  const load = useCallback(() => {
    setErr(null)
    getTodos(company.id, mine, showDone ? undefined : 'open')
      .then(r => setRows(r.rows))
      .catch(e => setErr(e.message))
  }, [company.id, mine, showDone])

  useEffect(() => { setRows(null); load() }, [load])

  const toggle = async (t: Todo) => {
    const next = t.status === 'done' ? 'open' : 'done'
    // Optimistic — flip locally, then reconcile from the server's copy.
    setRows(rs => rs ? rs.map(x => (x.id === t.id ? { ...x, status: next } as Todo : x)) : rs)
    try { await setTodoStatus(t.id, next, t.rev); load() }
    catch (e: any) { setErr(e.message); load() }
  }

  const open = rows ? rows.filter(r => r.status === 'open') : []
  const done = rows ? rows.filter(r => r.status === 'done') : []

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1>To-Dos</h1>
          <div className="page__sub">
            Seven-day commitments. If it takes longer than that, it wants to be a Rock.
          </div>
        </div>
        <div className="page__actions">
          <div className="seg" role="group" aria-label="Scope">
            <button aria-pressed={!mine} onClick={() => setMine(false)}>Team</button>
            <button aria-pressed={mine} onClick={() => setMine(true)}>Mine</button>
          </div>
          <button className="btn" aria-pressed={showDone} onClick={() => setShowDone(s => !s)}>
            {showDone ? 'Hide done' : 'Show done'}
          </button>
          <button className="btn btn--primary" onClick={() => setEditing('new')}>+ To-Do</button>
        </div>
      </div>

      <ErrorBanner error={err} onDismiss={() => setErr(null)} />

      {!rows ? (
        <Loading what="Loading to-dos" />
      ) : rows.length === 0 ? (
        <div className="card">
          <Empty title={mine ? 'Nothing on your list' : 'No open to-dos'}>
            Most to-dos are created by solving an issue in the L10 — that's the point of the list.
          </Empty>
        </div>
      ) : (
        <>
          <div className="card card__body--flush">
            <div className="rows">
              {open.map(t => (
                <TodoRow key={t.id} todo={t} onToggle={() => toggle(t)} onEdit={() => setEditing(t)} onDrop={() => setDropFor(t)} />
              ))}
              {open.length === 0 && <Empty title="Everything's done" />}
            </div>
          </div>

          {showDone && done.length > 0 && (
            <div className="card">
              <div className="card__head"><h3>Done</h3><span className="card__end mono faint">{done.length}</span></div>
              <div className="card__body--flush">
                <div className="rows">
                  {done.map(t => (
                    <TodoRow key={t.id} todo={t} onToggle={() => toggle(t)} onEdit={() => setEditing(t)} onDrop={() => setDropFor(t)} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {editing && (
        <TodoModal
          initial={editing === 'new' ? null : editing}
          companyId={company.id}
          team={team}
          defaultOwnerId={me.id}
          defaultOwnerName={me.name}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}

      {dropFor && (
        <DropToIssueModal
          origin={{ kind: 'todo', id: dropFor.id, label: dropFor.title }}
          suggestedTitle={dropFor.title}
          onClose={() => setDropFor(null)}
        />
      )}
    </div>
  )
}

export function TodoRow({
  todo, onToggle, onEdit, onDrop, showCompany,
}: {
  todo: Todo
  onToggle: () => void
  onEdit?: () => void
  onDrop?: () => void
  showCompany?: boolean
}) {
  const isDone = todo.status === 'done'
  return (
    <div className={'rowitem' + (isDone ? ' rowitem--done' : '')}>
      <button
        className={'check' + (isDone ? ' check--on' : '')}
        onClick={onToggle}
        aria-label={isDone ? `Mark "${todo.title}" not done` : `Mark "${todo.title}" done`}
      >
        ✓
      </button>
      <Avatar name={todo.ownerName} id={todo.ownerId} sm />
      <div className="rowitem__main">
        <div className="rowitem__title">
          {todo.title}
          {todo.personal && <span className="pill pill--muted" title="Only you can see this">personal</span>}
          {todo.origin && todo.origin.kind === 'issue' && (
            <span className="pill pill--muted" title={todo.origin.label}>from issue</span>
          )}
        </div>
        <div className="rowitem__meta">
          <span>{firstLast({ name: todo.ownerName }) || 'Unassigned'}</span>
          {todo.dueDate && (
            <span className={dueClass(todo.dueDate, isDone)}>
              {todo.dueDate < plusDaysIso(0) && !isDone ? 'overdue — ' : 'due '}{fmtDate(todo.dueDate)}
            </span>
          )}
          {showCompany && todo.companyName && <span className="faint">{todo.companyName}</span>}
        </div>
      </div>
      {(onEdit || onDrop) && (
        <div className="rowitem__end">
          <RowMenu>
            {close => (
              <>
                {onEdit && <button onClick={() => { close(); onEdit() }}>Edit to-do</button>}
                {onDrop && <button onClick={() => { close(); onDrop() }}>Drop to Issues</button>}
              </>
            )}
          </RowMenu>
        </div>
      )}
    </div>
  )
}

function TodoModal({
  initial, companyId, team, defaultOwnerId, defaultOwnerName, onClose, onSaved,
}: {
  initial: Todo | null
  companyId: string
  team: any[]
  defaultOwnerId: string
  defaultOwnerName: string
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(initial?.title || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [ownerId, setOwnerId] = useState(initial?.ownerId || defaultOwnerId || '')
  const [ownerName, setOwnerName] = useState(initial?.ownerName || defaultOwnerName || '')
  const [dueDate, setDueDate] = useState(initial?.dueDate || plusDaysIso(7))
  const [personal, setPersonal] = useState(!!initial?.personal)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!title.trim()) { setErr('A to-do needs a title.'); return }
    setBusy(true); setErr(null)
    try {
      await saveTodo({
        companyId, id: initial?.id, rev: initial?.rev,
        title: title.trim(), description, ownerId, ownerName, dueDate, personal,
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
      title={initial ? 'Edit to-do' : 'New to-do'}
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
        <label htmlFor="t-title">To-Do</label>
        <input id="t-title" className="input" value={title} autoFocus onChange={e => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="t-desc">Notes <span className="faint">(optional)</span></label>
        <textarea id="t-desc" className="textarea" value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      <div className="row2">
        <div className="field">
          <label>Owner</label>
          <OwnerPicker team={team} value={ownerId} valueName={ownerName} onChange={(id, n) => { setOwnerId(id); setOwnerName(n) }} />
        </div>
        <div className="field">
          <label htmlFor="t-due">Due</label>
          <input id="t-due" className="input" type="date" value={dueDate || ''} onChange={e => setDueDate(e.target.value)} />
          <div className="field__hint">Seven days out by default.</div>
        </div>
      </div>
      <div className="field">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 520 }}>
          <input type="checkbox" checked={personal} onChange={e => setPersonal(e.target.checked)} />
          Personal — only you can see it, and it stays out of the L10
        </label>
      </div>
    </Modal>
  )
}
