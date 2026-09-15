import { useCallback, useEffect, useState } from 'react'
import { getRocks, getRocksBoard, saveRock, setRockStatus, setRockRollUp, saveMilestone, addRockNote, carryForwardRocks } from '../api'
import type { Rock, Milestone, RockScope, RockScopeCounts } from '../api'
import { useApp } from '../state'
import {
  Avatar, Empty, ErrorBanner, Loading, Modal, OwnerPicker, RowMenu, StatusPill,
  dueClass, fmtDate, firstLast, plusDaysIso,
} from '../lib/ui'
import { DropToIssueModal } from '../components/DropToIssue'

/*
 * Rocks as rows with a status pill, milestones expanding inline underneath —
 * Ninety's shape. Status is On Track / Off Track / Done and the OWNER sets it:
 * completing milestones deliberately does not move it, because the point is that
 * the owner says it out loud in the L10. We nudge; we never auto-flip.
 */
export default function Rocks() {
  const { company, team, me } = useApp()
  const [view, setView] = useState<'list' | 'board'>('list')
  const [scope, setScope] = useState<RockScope>('own')
  const [counts, setCounts] = useState<RockScopeCounts | null>(null)
  const [rows, setRows] = useState<Rock[] | null>(null)
  const [board, setBoard] = useState<{ columns: { quarterKey: string; rows: Rock[] }[] } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<Rock | 'new' | null>(null)
  const [dropFor, setDropFor] = useState<Rock | null>(null)
  const [noteFor, setNoteFor] = useState<Rock | null>(null)
  const [carry, setCarry] = useState<Rock[] | null>(null)

  const load = useCallback(() => {
    setErr(null)
    if (view === 'list') {
      getRocks(company.id, undefined, false, scope)
        .then(r => { setRows(r.rows); setCounts(r.counts) })
        .catch(e => setErr(e.message))
    } else {
      getRocksBoard(company.id, undefined, scope).then(setBoard).catch(e => setErr(e.message))
    }
  }, [company.id, view, scope])

  useEffect(() => { setRows(null); setBoard(null); load() }, [load])

  const quarter = company.periods.quarter

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1>Rocks</h1>
          <div className="page__sub">
            {scope === 'own'
              ? `3–7 priorities for ${quarter}, each with one accountable owner. The owner declares status.`
              : scope === 'rolled'
                ? `${quarter} — this company's rocks, plus the ones raised up from the companies beneath it.`
                : `${quarter} — every rock in every company you can see.`}
          </div>
        </div>
        <div className="page__actions">
          {/*
            Only a unit with something beneath it ever sees this. An operating
            company resolves to exactly one company, so the server returns
            companies === 1 and there is nothing to switch between.
          */}
          {counts && counts.companies > 1 && (
            <div className="seg" role="group" aria-label="Which rocks">
              <button
                aria-pressed={scope === 'own'}
                onClick={() => setScope('own')}
                title="Only this company's rocks"
              >
                This company <span className="faint">{counts.own}</span>
              </button>
              <button
                aria-pressed={scope === 'rolled'}
                onClick={() => setScope('rolled')}
                title="This company, plus rocks raised up from the companies beneath it"
              >
                Rolled up <span className="faint">{counts.rolled}</span>
              </button>
              <button
                aria-pressed={scope === 'all'}
                onClick={() => setScope('all')}
                title="Every rock in every company you can see"
              >
                All companies <span className="faint">{counts.all}</span>
              </button>
            </div>
          )}
          <div className="seg" role="group" aria-label="View">
            <button aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
            <button aria-pressed={view === 'board'} onClick={() => setView('board')}>Planning board</button>
          </div>
          {/* Carry-forward is a per-company act — never offer it for rolled-up rows. */}
          {view === 'list' && rows && rows.some(r => !r.foreign && r.status !== 'done') && (
            <button className="btn" onClick={() => setCarry(rows.filter(r => !r.foreign && r.status !== 'done'))}>
              Carry forward…
            </button>
          )}
          <button className="btn btn--primary" onClick={() => setEditing('new')}>+ Rock</button>
        </div>
      </div>

      <ErrorBanner error={err} onDismiss={() => setErr(null)} />

      {view === 'list' ? (
        !rows ? <Loading what="Loading rocks" /> :
        rows.length === 0 ? (
          <div className="card">
            <Empty title={`No rocks for ${quarter} yet`}>
              A Rock is a 90-day priority with a single owner. Keep it to 3–7 — that constraint is
              most of what makes them work.
            </Empty>
          </div>
        ) : (
          <div className="card card__body--flush">
            <div className="rows">
              {rows.map(r => (
                <RockRow
                  key={r.id}
                  rock={r}
                  onChanged={load}
                  onEdit={() => setEditing(r)}
                  onDrop={() => setDropFor(r)}
                  onNote={() => setNoteFor(r)}
                  onError={setErr}
                />
              ))}
            </div>
          </div>
        )
      ) : !board ? (
        <Loading what="Loading the board" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(232px, 1fr))', gap: 12 }}>
          {board.columns.map((col, i) => (
            <div className="card" key={col.quarterKey} style={{ marginTop: 0 }}>
              <div className="card__head">
                <h3>{col.quarterKey}</h3>
                {i === 0 && <span className="pill pill--muted">current</span>}
                <span className="card__end mono faint">{col.rows.length}</span>
              </div>
              <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {col.rows.length === 0 && <span className="faint" style={{ fontSize: 12.5 }}>Empty</span>}
                {col.rows.map(r => (
                  <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '7px 9px' }}>
                    <div style={{ fontWeight: 560, marginBottom: 4 }}>{r.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <Avatar name={r.ownerName} id={r.ownerId} sm />
                      <StatusPill status={r.status} />
                      {r.foreign && r.companyName && <span className="pill pill--muted">{r.companyName}</span>}
                      {r.companyRock && <span className="pill pill--muted">company</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <RockModal
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
          origin={{ kind: 'rock', id: dropFor.id, label: dropFor.title }}
          suggestedTitle={`${dropFor.title} is off track`}
          onClose={() => setDropFor(null)}
        />
      )}

      {noteFor && (
        <NoteModal rock={noteFor} onClose={() => setNoteFor(null)} onSaved={() => { setNoteFor(null); load() }} />
      )}

      {carry && (
        <CarryModal
          rocks={carry}
          fromQuarter={quarter}
          onClose={() => setCarry(null)}
          onDone={() => { setCarry(null); load() }}
        />
      )}
    </div>
  )
}

function RockRow({
  rock, onChanged, onEdit, onDrop, onNote, onError,
}: {
  rock: Rock
  onChanged: () => void
  onEdit: () => void
  onDrop: () => void
  onNote: () => void
  onError: (m: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const { team, me } = useApp()
  const [adding, setAdding] = useState(false)

  const done = rock.milestones.filter(m => m.done).length
  const overdueOpen = rock.milestones.filter(m => !m.done && m.dueDate && m.dueDate < plusDaysIso(0)).length

  const cycle = async () => {
    // On Track -> Off Track -> Done -> On Track. Explicit, and the owner's call.
    const next = rock.status === 'on_track' ? 'off_track' : rock.status === 'off_track' ? 'done' : 'on_track'
    setBusy(true)
    try { await setRockStatus(rock.id, next, rock.rev); onChanged() }
    catch (e: any) { onError(e.message) }
    finally { setBusy(false) }
  }

  const toggleMs = async (m: Milestone) => {
    setBusy(true)
    try { await saveMilestone(rock.id, { id: m.id, done: !m.done }, rock.rev); onChanged() }
    catch (e: any) { onError(e.message) }
    finally { setBusy(false) }
  }

  /*
   * Raise a rock into the parent unit's roll-up view, or lower it again. This is
   * visibility, not access: it can only ever surface the rock to a unit ABOVE
   * the one it lives on, and a sibling company never had it in view to begin
   * with. Either side can do it — the company that owns the rock, or the parent
   * watching it — because both can already see it.
   */
  const toggleRollUp = async () => {
    setBusy(true)
    try { await setRockRollUp(rock.id, !rock.rollUp, rock.rev); onChanged() }
    catch (e: any) { onError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <>
      <div className="rowitem">
        <button
          className="btn btn--sm btn--ghost"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-label={open ? 'Hide milestones' : 'Show milestones'}
          style={{ padding: '2px 5px' }}
        >
          {open ? '▾' : '▸'}
        </button>
        <Avatar name={rock.ownerName} id={rock.ownerId} />
        <div className="rowitem__main">
          <div className="rowitem__title">
            {rock.title}
            {/* Where it lives — only shown once the list spans more than one company. */}
            {rock.foreign && rock.companyName && (
              <span className="pill pill--muted" title={`This rock lives on ${rock.companyName}`}>
                {rock.companyName}
              </span>
            )}
            {rock.rollUp && (
              <span className="pill pill--amber" title="Raised into the parent unit's roll-up view">
                <span className="pill__glyph" aria-hidden="true">↑</span> rolled up
              </span>
            )}
            {rock.companyRock && <span className="pill pill--muted">company</span>}
            {rock.carriedFrom && (
              <span className="pill pill--amber" title="Carried forward from a previous quarter">
                <span className="pill__glyph" aria-hidden="true">↻</span> carried
              </span>
            )}
          </div>
          <div className="rowitem__meta">
            <span>{firstLast({ name: rock.ownerName }) || 'Unassigned'}</span>
            {rock.dueDate && <span className={dueClass(rock.dueDate, rock.status === 'done')}>due {fmtDate(rock.dueDate)}</span>}
            {rock.milestones.length > 0 && (
              <span className="mono">{done}/{rock.milestones.length} milestones</span>
            )}
            {/* Nudge, never auto-flip. */}
            {overdueOpen > 0 && rock.status === 'on_track' && (
              <span className="duesoon">
                {overdueOpen} milestone{overdueOpen > 1 ? 's' : ''} overdue — still on track?
              </span>
            )}
          </div>
        </div>
        <div className="rowitem__end">
          <button className="btn btn--sm btn--ghost" onClick={cycle} disabled={busy} title="Change status">
            <StatusPill status={rock.status} />
          </button>
          <RowMenu>
            {close => (
              <>
                <button onClick={() => { close(); onEdit() }}>Edit rock</button>
                <button onClick={() => { close(); setOpen(true); setAdding(true) }}>Add milestone</button>
                <button onClick={() => { close(); onNote() }}>Add a note</button>
                <hr />
                <button onClick={() => { close(); toggleRollUp() }} disabled={busy}>
                  {rock.rollUp ? 'Remove from the roll-up' : 'Raise into the roll-up'}
                </button>
                <hr />
                <button onClick={() => { close(); onDrop() }}>Drop to Issues</button>
              </>
            )}
          </RowMenu>
        </div>
      </div>

      {open && (
        <div className="rowitem__expand">
          {rock.description && <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{rock.description}</p>}

          {rock.milestones.length === 0 && !adding && (
            <div className="faint" style={{ fontSize: 12.5, padding: '7px 0' }}>
              No milestones. They're named sub-steps with their own date — useful, and they never
              change the Rock's status.
            </div>
          )}

          {rock.milestones.map(m => (
            <div className={'ms' + (m.done ? ' ms--done' : '')} key={m.id}>
              <button
                className={'check' + (m.done ? ' check--on' : '')}
                onClick={() => toggleMs(m)}
                disabled={busy}
                aria-label={m.done ? `Mark "${m.title}" not done` : `Mark "${m.title}" done`}
              >
                ✓
              </button>
              <span className="ms__t">{m.title}</span>
              {m.dueDate && <span className={'mono faint ' + dueClass(m.dueDate, m.done)} style={{ fontSize: 11.5 }}>{fmtDate(m.dueDate)}</span>}
              <button
                className="btn btn--sm btn--ghost btn--danger"
                title="Remove milestone"
                onClick={async () => {
                  if (!confirm(`Remove milestone "${m.title}"?`)) return
                  try { await saveMilestone(rock.id, { id: m.id, remove: true }, rock.rev); onChanged() }
                  catch (e: any) { onError(e.message) }
                }}
              >
                ✕
              </button>
            </div>
          ))}

          {adding ? (
            <MilestoneAdd
              rock={rock}
              team={team}
              defaultOwnerId={rock.ownerId || me.id}
              onCancel={() => setAdding(false)}
              onSaved={() => { setAdding(false); onChanged() }}
              onError={onError}
            />
          ) : (
            <button className="btn btn--sm" style={{ marginTop: 8 }} onClick={() => setAdding(true)}>+ Milestone</button>
          )}

          {rock.notes.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="nav__section" style={{ padding: '0 0 4px' }}>Notes</div>
              {rock.notes.slice().reverse().map(n => (
                <div key={n.id} style={{ fontSize: 12.5, padding: '4px 0', borderTop: '1px dashed var(--border)' }}>
                  <span className="faint">{firstLast({ name: n.byName })} · {n.at.slice(0, 10)}</span>
                  <div>{n.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

function MilestoneAdd({
  rock, team, defaultOwnerId, onCancel, onSaved, onError,
}: {
  rock: Rock
  team: any[]
  defaultOwnerId: string
  onCancel: () => void
  onSaved: () => void
  onError: (m: string) => void
}) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [ownerId, setOwnerId] = useState(defaultOwnerId)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!title.trim()) return
    setBusy(true)
    try { await saveMilestone(rock.id, { title: title.trim(), dueDate, ownerId }, rock.rev); onSaved() }
    catch (e: any) { onError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div style={{ marginTop: 9, display: 'flex', gap: 7, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <input
        className="input" style={{ flex: '2 1 200px' }} autoFocus placeholder="Milestone"
        value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel() }}
      />
      <input className="input" style={{ flex: '0 1 150px' }} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
      <select className="select" style={{ flex: '1 1 150px' }} value={ownerId} onChange={e => setOwnerId(e.target.value)}>
        <option value="">— Owner —</option>
        {team.map(p => <option key={p.id} value={p.id}>{firstLast(p)}</option>)}
      </select>
      <button className="btn btn--primary btn--sm" onClick={save} disabled={busy || !title.trim()}>Add</button>
      <button className="btn btn--sm" onClick={onCancel}>Cancel</button>
    </div>
  )
}

function RockModal({
  initial, companyId, team, defaultOwnerId, defaultOwnerName, onClose, onSaved,
}: {
  initial: Rock | null
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
  const [dueDate, setDueDate] = useState(initial?.dueDate || '')
  const [companyRock, setCompanyRock] = useState(!!initial?.companyRock)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!title.trim()) { setErr('A rock needs a title.'); return }
    setBusy(true); setErr(null)
    try {
      await saveRock({
        companyId, id: initial?.id, rev: initial?.rev,
        title: title.trim(), description, ownerId, ownerName, dueDate, companyRock,
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
      title={initial ? 'Edit rock' : 'New rock'}
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
        <label htmlFor="r-title">Rock</label>
        <input id="r-title" className="input" value={title} autoFocus onChange={e => setTitle(e.target.value)}
               placeholder="e.g. Hire and onboard 2 RCs for the swing shift" />
      </div>
      <div className="field">
        <label htmlFor="r-desc">Description <span className="faint">(optional)</span></label>
        <textarea id="r-desc" className="textarea" value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      <div className="row2">
        <div className="field">
          <label>Owner</label>
          <OwnerPicker team={team} value={ownerId} valueName={ownerName} onChange={(id, n) => { setOwnerId(id); setOwnerName(n) }} />
          <div className="field__hint">One person, always.</div>
        </div>
        <div className="field">
          <label htmlFor="r-due">Due date</label>
          <input id="r-due" className="input" type="date" value={dueDate || ''} onChange={e => setDueDate(e.target.value)} />
          <div className="field__hint">The quarter is worked out from this, and you can override it later.</div>
        </div>
      </div>
      <div className="field">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 520 }}>
          <input type="checkbox" checked={companyRock} onChange={e => setCompanyRock(e.target.checked)} />
          This is a company Rock (org-wide, not one person's own)
        </label>
      </div>
    </Modal>
  )
}

function NoteModal({ rock, onClose, onSaved }: { rock: Rock; onClose: () => void; onSaved: () => void }) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!body.trim()) return
    setBusy(true); setErr(null)
    try { await addRockNote(rock.id, body.trim()); onSaved() }
    catch (e: any) { setErr(e.message); setBusy(false) }
  }

  return (
    <Modal
      title="Add a note"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn--primary" onClick={submit} disabled={busy || !body.trim()}>Add note</button>
        </>
      }
    >
      <ErrorBanner error={err} onDismiss={() => setErr(null)} />
      <div className="field">
        <label htmlFor="n-body">{rock.title}</label>
        <textarea id="n-body" className="textarea" autoFocus value={body} onChange={e => setBody(e.target.value)}
                  placeholder="What changed?" />
      </div>
    </Modal>
  )
}

/*
 * Quarter-end carry-forward. It PROPOSES: you tick the rocks that should roll,
 * and each one is recreated in the new quarter with a link back to the original.
 * Nothing moves on its own — silently relocating someone's Rock is exactly the
 * kind of thing that destroys trust in a tool like this.
 */
function CarryModal({
  rocks, fromQuarter, onClose, onDone,
}: { rocks: Rock[]; fromQuarter: string; onClose: () => void; onDone: () => void }) {
  const [picked, setPicked] = useState<string[]>([])
  const [toQuarter, setToQuarter] = useState(nextQuarter(fromQuarter))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!picked.length) { setErr('Pick at least one rock to carry forward.'); return }
    setBusy(true); setErr(null)
    try { await carryForwardRocks(picked, toQuarter); onDone() }
    catch (e: any) { setErr(e.message); setBusy(false) }
  }

  return (
    <Modal
      title="Carry rocks forward"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn--primary" onClick={submit} disabled={busy}>
            {busy ? 'Carrying…' : `Carry ${picked.length || ''} to ${toQuarter}`}
          </button>
        </>
      }
    >
      <ErrorBanner error={err} onDismiss={() => setErr(null)} />
      <div className="field">
        <label htmlFor="cf-q">Carry into</label>
        <input id="cf-q" className="input" value={toQuarter} onChange={e => setToQuarter(e.target.value.toUpperCase())} placeholder="2026-Q4" />
        <div className="field__hint">
          Each rock is recreated there with its unfinished milestones and a link back to this
          quarter's, so a rock that drags on stays visible instead of quietly resetting.
        </div>
      </div>
      <div className="card card__body--flush" style={{ marginTop: 4 }}>
        <div className="rows">
          {rocks.map(r => (
            <label className="rowitem" key={r.id} style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={picked.includes(r.id)}
                onChange={e => setPicked(p => (e.target.checked ? [...p, r.id] : p.filter(x => x !== r.id)))}
              />
              <Avatar name={r.ownerName} id={r.ownerId} sm />
              <div className="rowitem__main">
                <div className="rowitem__title">{r.title}</div>
                <div className="rowitem__meta">
                  <span>{r.milestones.filter(m => !m.done).length} milestones still open</span>
                </div>
              </div>
              <StatusPill status={r.status} />
            </label>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function nextQuarter(qk: string): string {
  const m = /^(\d{4})-Q([1-4])$/.exec(qk)
  if (!m) return qk
  let y = Number(m[1]), q = Number(m[2]) + 1
  if (q > 4) { q = 1; y++ }
  return `${y}-Q${q}`
}
