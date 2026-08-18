import { useState } from 'react'
import { dropToIssue, createLinkedTodo } from '../api'
import type { Origin } from '../api'
import { useApp } from '../state'
import { Modal, OwnerPicker, ErrorBanner, plusDaysIso } from '../lib/ui'

/*
 * "Drop to Issue" is the highest-traffic write in the product: it is reachable
 * from scorecard cells, rock rows, headlines and to-dos, and it is what makes an
 * L10 work at all. One component, used everywhere, so it behaves identically.
 */
export function DropToIssueModal({
  origin, suggestedTitle, onClose, onDone,
}: {
  origin: Origin
  suggestedTitle: string
  onClose: () => void
  onDone?: () => void
}) {
  const { company } = useApp()
  const [title, setTitle] = useState(suggestedTitle)
  const [description, setDescription] = useState('')
  const [term, setTerm] = useState<'short' | 'long'>('short')
  const [priority, setPriority] = useState(3)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!title.trim()) { setErr('An issue needs a title.'); return }
    setBusy(true); setErr(null)
    try {
      await dropToIssue({ companyId: company.id, title: title.trim(), description, term, priority, origin })
      onDone?.()
      onClose()
    } catch (e: any) {
      setErr(e.message || 'Could not create the issue.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Drop to Issues"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn--primary" onClick={submit} disabled={busy}>
            {busy ? 'Adding…' : 'Add to Issues'}
          </button>
        </>
      }
    >
      <ErrorBanner error={err} onDismiss={() => setErr(null)} />
      {origin.kind !== 'manual' && (
        <div className="banner" style={{ marginBottom: 12 }}>
          <div>
            <div className="banner__b">From {origin.kind}</div>
            <span className="muted">{origin.label || origin.id}</span>
            <div className="field__hint">
              The issue remembers where it came from, so you can trace it back later.
            </div>
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="dti-title">Issue</label>
        <input id="dti-title" className="input" value={title} autoFocus onChange={e => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="dti-desc">Context <span className="faint">(optional)</span></label>
        <textarea id="dti-desc" className="textarea" value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      <div className="row2">
        <div className="field">
          <label htmlFor="dti-term">List</label>
          <select id="dti-term" className="select" value={term} onChange={e => setTerm(e.target.value as any)}>
            <option value="short">Short-term (this quarter's L10)</option>
            <option value="long">Long-term (the parking lot)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="dti-pri">Priority</label>
          <select id="dti-pri" className="select" value={priority} onChange={e => setPriority(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}{n === 1 ? ' — highest' : n === 5 ? ' — lowest' : ''}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  )
}

/*
 * The output of a solved issue is almost always a To-Do — this keeps the two
 * linked in both directions rather than leaving an orphan task.
 */
export function LinkedTodoModal({
  issueId, issueTitle, onClose, onDone,
}: {
  issueId: string
  issueTitle: string
  onClose: () => void
  onDone?: () => void
}) {
  const { team } = useApp()
  const [title, setTitle] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [dueDate, setDueDate] = useState(plusDaysIso(7))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!title.trim()) { setErr('A to-do needs a title.'); return }
    setBusy(true); setErr(null)
    try {
      await createLinkedTodo({ issueId, title: title.trim(), ownerId, ownerName, dueDate })
      onDone?.()
      onClose()
    } catch (e: any) {
      setErr(e.message || 'Could not create the to-do.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Create a linked To-Do"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn--primary" onClick={submit} disabled={busy}>
            {busy ? 'Creating…' : 'Create To-Do'}
          </button>
        </>
      }
    >
      <ErrorBanner error={err} onDismiss={() => setErr(null)} />
      <div className="banner" style={{ marginBottom: 12 }}>
        <div><div className="banner__b">Solving</div><span className="muted">{issueTitle}</span></div>
      </div>
      <div className="field">
        <label htmlFor="lt-title">What needs doing?</label>
        <input id="lt-title" className="input" value={title} autoFocus onChange={e => setTitle(e.target.value)} />
      </div>
      <div className="row2">
        <div className="field">
          <label>Owner</label>
          <OwnerPicker team={team} value={ownerId} valueName={ownerName} onChange={(id, n) => { setOwnerId(id); setOwnerName(n) }} />
        </div>
        <div className="field">
          <label htmlFor="lt-due">Due</label>
          <input id="lt-due" className="input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          <div className="field__hint">Seven days out by default. Longer than that should be a Rock.</div>
        </div>
      </div>
    </Modal>
  )
}
