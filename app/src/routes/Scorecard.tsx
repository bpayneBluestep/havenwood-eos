import { useCallback, useEffect, useMemo, useState } from 'react'
import { getScorecard, saveMeasurable, setScore, archiveMeasurable } from '../api'
import type { Measurable, Scorecard as SC, Cell } from '../api'
import { useApp } from '../state'
import {
  Avatar, Empty, ErrorBanner, Loading, Modal, OwnerPicker, RowMenu,
  cellClass, cellMark, fmtGoal, fmtValue, shortPeriod, firstLast,
} from '../lib/ui'
import { DropToIssueModal } from '../components/DropToIssue'

/*
 * The scorecard is a GRID, not cards: rows are measurables, columns are the last
 * 13 periods, and the first column is sticky so the title, owner and goal stay
 * visible while you scroll the numbers. Every cell is directly editable, because
 * entering a week of numbers is the single most common thing anyone does here.
 *
 * Columns run OLDEST -> NEWEST left to right so the current week sits nearest the
 * eye when the grid is scrolled to its end, and reading left-to-right reads as
 * time passing.
 */
export default function Scorecard() {
  const { company, team, me } = useApp()
  const [cadence, setCadence] = useState('weekly')
  const [sc, setSc] = useState<SC | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<Measurable | 'new' | null>(null)
  const [dropFor, setDropFor] = useState<Measurable | null>(null)

  const load = useCallback(() => {
    setErr(null)
    getScorecard(company.id, cadence, 13)
      .then(setSc)
      .catch(e => setErr(e.message))
  }, [company.id, cadence])

  useEffect(() => { setSc(null); load() }, [load])

  const cadences = company.settings.scorecardCadences?.length ? company.settings.scorecardCadences : ['weekly']
  const escalating = useMemo(() => (sc ? sc.rows.filter(r => r.escalate) : []), [sc])

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1>Scorecard</h1>
          <div className="page__sub">
            The 5–15 numbers that tell you whether the week worked. Click any cell to type a value.
          </div>
        </div>
        <div className="page__actions">
          {cadences.length > 1 && (
            <div className="seg" role="group" aria-label="Cadence">
              {cadences.map(c => (
                <button key={c} aria-pressed={cadence === c} onClick={() => setCadence(c)}>
                  {c[0].toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>
          )}
          <button className="btn btn--primary" onClick={() => setEditing('new')}>+ Measurable</button>
        </div>
      </div>

      <ErrorBanner error={err} onDismiss={() => setErr(null)} />

      {/* The three-week rule is the most useful thing Ninety does, so it gets a
          banner rather than being buried in a row. */}
      {escalating.length > 0 && (
        <div className="banner banner--warn">
          <div>
            <div className="banner__b">
              {escalating.length === 1 ? 'One measurable has' : `${escalating.length} measurables have`} missed
              goal three periods running.
            </div>
            EOS says that belongs on the Issues list. Use the ⋯ menu on the row to drop it there.
          </div>
        </div>
      )}

      {!sc ? (
        <Loading what="Loading the scorecard" />
      ) : sc.rows.length === 0 ? (
        <div className="card">
          <Empty title="No measurables yet">
            Add the 5–15 numbers your leadership team already reviews each week. Each one needs an
            owner and a goal — everything else is derived.
          </Empty>
        </div>
      ) : (
        <div className="card card__body--flush">
          <div className="gridwrap">
            <table className="grid">
              <thead>
                <tr>
                  <th className="c-meas">Measurable</th>
                  {sc.periods.map(p => (
                    <th key={p} scope="col" title={p}>
                      {shortPeriod(p)}
                      {p === sc.currentPeriod && <div className="faint" style={{ fontSize: 9, fontWeight: 700 }}>NOW</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withGroupHeaders(sc.rows).map(item =>
                  item.kind === 'group' ? (
                    <tr className="grid__group" key={'g-' + item.label}>
                      <td colSpan={sc.periods.length + 1}>{item.label}</td>
                    </tr>
                  ) : (
                    <Row
                      key={item.row.id}
                      row={item.row}
                      current={sc.currentPeriod}
                      onEdit={() => setEditing(item.row)}
                      onDrop={() => setDropFor(item.row)}
                      onArchive={async () => {
                        if (!confirm(`Archive "${item.row.title}"? Its history is kept.`)) return
                        try { await archiveMeasurable(item.row.id); load() } catch (e: any) { setErr(e.message) }
                      }}
                      onSaved={load}
                      onError={setErr}
                    />
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <MeasurableModal
          initial={editing === 'new' ? null : editing}
          companyId={company.id}
          team={team}
          defaultOwnerId={me.id}
          defaultOwnerName={me.name}
          cadence={cadence}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}

      {dropFor && (
        <DropToIssueModal
          origin={{ kind: 'measurable', id: dropFor.id, label: dropFor.title }}
          suggestedTitle={`${dropFor.title} has missed goal 3 periods running`}
          onClose={() => setDropFor(null)}
        />
      )}
    </div>
  )
}

/** Measurables can be organised into labelled groups (Sales, Clinical, Ops…). */
type Item = { kind: 'group'; label: string } | { kind: 'row'; row: Measurable }
function withGroupHeaders(rows: Measurable[]): Item[] {
  const out: Item[] = []
  let last: string | null = null
  const anyGroups = rows.some(r => r.group)
  for (const row of rows) {
    const g = row.group || ''
    if (anyGroups && g !== last) {
      out.push({ kind: 'group', label: g || 'Ungrouped' })
      last = g
    }
    out.push({ kind: 'row', row })
  }
  return out
}

function Row({
  row, current, onEdit, onDrop, onArchive, onSaved, onError,
}: {
  row: Measurable
  current: string
  onEdit: () => void
  onDrop: () => void
  onArchive: () => void
  onSaved: () => void
  onError: (m: string) => void
}) {
  return (
    <tr>
      <th className="c-meas" scope="row">
        <div className="meas__title">
          <span>{row.title}</span>
          {row.escalate && (
            <span className="badge-escalate" title="Three consecutive periods off goal">
              <span aria-hidden="true">▲</span> 3 weeks red
            </span>
          )}
        </div>
        <div className="meas__sub">
          <span className="owner">
            <Avatar name={row.ownerName} id={row.ownerId} sm />
            <span className="owner__name">{firstLast({ name: row.ownerName }) || 'Unassigned'}</span>
          </span>
          <span className="meas__goal">{fmtGoal(row.goal, row.valueType)}</span>
          <span style={{ marginLeft: 'auto' }}>
            <RowMenu>
              {close => (
                <>
                  <button onClick={() => { close(); onEdit() }}>Edit measurable</button>
                  <button onClick={() => { close(); onDrop() }}>Drop to Issues</button>
                  <hr />
                  <button onClick={() => { close(); onArchive() }}>Archive</button>
                </>
              )}
            </RowMenu>
          </span>
        </div>
      </th>

      {row.cells.map(c => (
        <ScoreCell
          key={c.periodKey}
          measurableId={row.id}
          cell={c}
          valueType={row.valueType}
          isNow={c.periodKey === current}
          onSaved={onSaved}
          onError={onError}
        />
      ))}
    </tr>
  )
}

/*
 * A single editable cell. Optimistic: the typed value shows immediately, the
 * write goes out on blur, and the row is refetched so the derived status and the
 * three-week flag come from the server rather than being guessed here.
 */
function ScoreCell({
  measurableId, cell, valueType, isNow, onSaved, onError,
}: {
  measurableId: string
  cell: Cell
  valueType: string
  isNow: boolean
  onSaved: () => void
  onError: (m: string) => void
}) {
  const [draft, setDraft] = useState<string>(cell.value === null ? '' : String(cell.value))
  const [busy, setBusy] = useState(false)

  // Keep in step when the server sends a new value (e.g. after another edit).
  useEffect(() => { setDraft(cell.value === null ? '' : String(cell.value)) }, [cell.value])

  const commit = async () => {
    const original = cell.value === null ? '' : String(cell.value)
    if (draft.trim() === original) return
    const parsed = draft.trim() === '' ? null : Number(draft)
    if (parsed !== null && !isFinite(parsed)) { setDraft(original); return }
    setBusy(true)
    try {
      await setScore(measurableId, cell.periodKey, parsed)
      onSaved()
    } catch (e: any) {
      setDraft(original)
      onError(e.message || 'Could not save that value.')
    } finally {
      setBusy(false)
    }
  }

  const mark = cellMark(cell.status)
  const label = `${cell.periodKey}: ${cell.value === null ? 'no value' : fmtValue(cell.value, valueType)}${
    cell.status === 'red' ? ', off goal' : cell.status === 'green' ? ', on goal' : ''
  }`

  return (
    <td className={cellClass(cell.status) + (isNow ? ' cell--now' : '')}>
      {mark && <span className="cell__mark" aria-hidden="true">{mark}</span>}
      <input
        className="cell__in"
        type="number"
        step="any"
        inputMode="decimal"
        value={draft}
        aria-label={label}
        title={label}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') setDraft(cell.value === null ? '' : String(cell.value))
        }}
      />
      {busy && <span className="cell__saving" aria-hidden="true">•••</span>}
    </td>
  )
}

function MeasurableModal({
  initial, companyId, team, cadence, defaultOwnerId, defaultOwnerName, onClose, onSaved,
}: {
  initial: Measurable | null
  companyId: string
  team: any[]
  cadence: string
  defaultOwnerId: string
  defaultOwnerName: string
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(initial?.title || '')
  const [group, setGroup] = useState(initial?.group || '')
  const [ownerId, setOwnerId] = useState(initial?.ownerId || defaultOwnerId || '')
  const [ownerName, setOwnerName] = useState(initial?.ownerName || defaultOwnerName || '')
  const [valueType, setValueType] = useState(initial?.valueType || 'number')
  const [op, setOp] = useState(initial?.goal?.op || 'gte')
  const [target, setTarget] = useState(initial?.goal?.target === null || initial?.goal?.target === undefined ? '' : String(initial.goal.target))
  const [target2, setTarget2] = useState(initial?.goal?.target2 === null || initial?.goal?.target2 === undefined ? '' : String(initial.goal.target2))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!title.trim()) { setErr('A measurable needs a title.'); return }
    if (op !== 'none' && target.trim() === '') { setErr('A goal with an operator needs a target.'); return }
    if (op === 'between' && target2.trim() === '') { setErr('A between goal needs a second target.'); return }
    setBusy(true); setErr(null)
    try {
      await saveMeasurable({
        companyId,
        id: initial?.id,
        rev: initial?.rev,
        title: title.trim(),
        group: group.trim(),
        ownerId, ownerName,
        cadence: initial?.cadence || cadence,
        valueType,
        goal: {
          op,
          target: op === 'none' ? null : Number(target),
          target2: op === 'between' ? Number(target2) : null,
        },
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
      title={initial ? 'Edit measurable' : 'New measurable'}
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
        <label htmlFor="m-title">Measurable</label>
        <input id="m-title" className="input" value={title} autoFocus onChange={e => setTitle(e.target.value)}
               placeholder="e.g. Census — end of week" />
      </div>
      <div className="row2">
        <div className="field">
          <label>Owner</label>
          <OwnerPicker team={team} value={ownerId} valueName={ownerName} onChange={(id, n) => { setOwnerId(id); setOwnerName(n) }} />
          <div className="field__hint">Exactly one person is accountable for a number.</div>
        </div>
        <div className="field">
          <label htmlFor="m-group">Group <span className="faint">(optional)</span></label>
          <input id="m-group" className="input" value={group} onChange={e => setGroup(e.target.value)}
                 placeholder="Residential, Clinical, Ops…" />
        </div>
      </div>
      <div className="row3">
        <div className="field">
          <label htmlFor="m-vt">Value</label>
          <select id="m-vt" className="select" value={valueType} onChange={e => setValueType(e.target.value)}>
            <option value="number">Number</option>
            <option value="currency">Currency</option>
            <option value="percent">Percent</option>
            <option value="time">Time</option>
            <option value="yesno">Yes / No</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="m-op">Goal</label>
          <select id="m-op" className="select" value={op} onChange={e => setOp(e.target.value)}>
            <option value="gte">at least (≥)</option>
            <option value="gt">more than (&gt;)</option>
            <option value="lte">at most (≤)</option>
            <option value="lt">less than (&lt;)</option>
            <option value="eq">exactly (=)</option>
            <option value="between">between</option>
            <option value="none">no goal</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="m-t">{op === 'between' ? 'From' : 'Target'}</label>
          <input id="m-t" className="input" type="number" step="any" value={target}
                 disabled={op === 'none'} onChange={e => setTarget(e.target.value)} />
        </div>
      </div>
      {op === 'between' && (
        <div className="field">
          <label htmlFor="m-t2">To</label>
          <input id="m-t2" className="input" type="number" step="any" value={target2} onChange={e => setTarget2(e.target.value)} />
        </div>
      )}
      <div className="field__hint">
        Red and green are worked out from the goal every time the scorecard is read — change a
        target and the history recolours to match, which is what you want.
      </div>
    </Modal>
  )
}
