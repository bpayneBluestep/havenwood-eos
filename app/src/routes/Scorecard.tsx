import {validateSourceUrl, assignedTeams, compareMeasurables, orderMeasurables} from '../../../platform/scorecardModel'
import {newestPeriods} from '../lib/listModel'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getScorecard, saveMeasurable, setScore, archiveMeasurable, saveScorecardSections } from '../api'
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
 * The latest period is next to the measurable column. Cells follow the same
 * period sequence as the headings.
 */
export default function Scorecard({embedded=false}:{embedded?:boolean}) {
  const { company, team, me, scorecardEditing } = useApp()
  const [cadence, setCadence] = useState('weekly')
  const [sc, setSc] = useState<SC | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<Measurable | 'new' | null>(null)
  const [sectionsOpen, setSectionsOpen] = useState(false)
  const [sectionFocus,setSectionFocus]=useState<string | undefined>()
  const [dropFor, setDropFor] = useState<Measurable | null>(null)

  const load = useCallback(() => {
    setErr(null)
    getScorecard(company.id, cadence, 13)
      .then(setSc)
      .catch(e => setErr(e.message))
  }, [company.id, cadence])

  useEffect(() => { setSc(null); load() }, [load])

  const periods = newestPeriods(sc?.periods || [])
  const cadences = company.settings.scorecardCadences?.length ? company.settings.scorecardCadences : ['weekly']
  const escalating = useMemo(() => (sc ? sc.rows.filter(r => r.escalate) : []), [sc])

  return (
    <div className={embedded ? 'scorecard-workspace scorecard-workspace--embedded' : 'page scorecard-workspace'}>
      <div className="page__head">
        <div>
          {!embedded && <h1>Scorecard</h1>}
          <div className="page__sub">
            The 5–15 numbers that tell you whether the week worked. Click a value to edit it. Select a measurable title to change its number display.
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
          {scorecardEditing && sc && sc.rows.length > 0 && <button className="btn" onClick={() => {setSectionFocus(undefined);setSectionsOpen(true)}}>Manage sections</button>}
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
                  {periods.map(p => (
                    <th key={p} scope="col" title={p}>
                      {shortPeriod(p)}
                      {p === sc.currentPeriod && <div className="faint" style={{ fontSize: 9, fontWeight: 700 }}>NOW</div>}
                    </th>
                  ))}
                  <th className="c-fill" aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {withGroupHeaders(sc.rows).map(item =>
                  item.kind === 'group' ? (
                    <tr className="grid__group" key={'g-' + item.label}>
                      <td colSpan={sc.periods.length + 2}><span className="grid__group-label">{scorecardEditing ? <button type="button" className="section-title" title="Rename or move this section" onClick={()=>{setSectionFocus(item.label==='Ungrouped'?'':item.label);setSectionsOpen(true)}}>{item.label}<span aria-hidden="true"> ✎</span></button> : item.label}</span></td>
                    </tr>
                  ) : (
                    <Row
                      key={item.row.id}
                      row={item.row}
                      current={sc.currentPeriod}
                      periods={periods}
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

      {sectionsOpen && sc && <SectionsModal focusSection={sectionFocus} rows={sc.rows} companyId={company.id} cadence={cadence} onClose={() => setSectionsOpen(false)} onSaved={() => {setSectionsOpen(false); load()}}/>}

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
  for (const row of orderMeasurables(rows)) {
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
  row, current, periods, onEdit, onDrop, onArchive, onSaved, onError,
}: {
  row: Measurable
  current: string
  periods: string[]
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
          <button type="button" className="meas__title-link" title={row.title} onClick={onEdit} disabled={row.readOnly}>{row.title}</button>
          {row.sourceUrl && <a className="meas__source" href={row.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`Source material for ${row.title}`} title="Open source material">Source ↗</a>}
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
            {row.readOnly ? <span className="pill pill--muted" title={`Definition managed by ${row.sourceTeamName || 'the source team'}`}>Shared</span> : <RowMenu>
              {close => (
                <>
                  <button onClick={() => { close(); onEdit() }}>Edit measurable</button>
                  <button onClick={() => { close(); onDrop() }}>Drop to Issues</button>
                  <hr />
                  <button onClick={() => { close(); onArchive() }}>Archive</button>
                </>
              )}
            </RowMenu>}
          </span>
        </div>
      </th>

      {periods.map(period => row.cells.find(cell => cell.periodKey === period) || {periodKey: period, value: null, status: 'empty' as const, goal: row.goal, enteredBy: '', at: ''}).map(c => (
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
      <td className="c-fill" aria-hidden="true" />
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
  const [focused,setFocused]=useState(false)

  // Keep in step when the server sends a new value (e.g. after another edit).
  useEffect(() => { setDraft(cell.value === null ? '' : String(cell.value)) }, [cell.value])

  const commit = async () => {
    const original = cell.value === null ? '' : String(cell.value)
    if (draft.trim() === original) return
    const parsed = draft.trim() === '' ? null : Number(draft)
    if (parsed !== null && !isFinite(parsed)) { setDraft(original); return }
    setBusy(true)
    try {
      await setScore(measurableId, cell.scorePeriodKey || cell.periodKey, parsed)
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
      {!focused && <span className="cell__display" aria-hidden="true">{draft.trim() === '' ? '' : fmtValue(Number(draft),valueType)}</span>}
      <input
        className={'cell__in' + (!focused ? ' cell__in--formatted' : '')}
        type="number"
        step="any"
        inputMode="decimal"
        value={draft}
        aria-label={label}
        title={label}
        onChange={e => setDraft(e.target.value)}
        onFocus={()=>setFocused(true)}
        onBlur={()=>{setFocused(false);void commit()}}
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
  const {companies,scorecardEditing} = useApp()
  const sourceTeamId = initial?.sourceTeamId || companyId
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl || '')
  const [teamIds, setTeamIds] = useState(() => assignedTeams(sourceTeamId, initial?.assignedTeamIds))
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
      const validUrl = validateSourceUrl(sourceUrl)
      await saveMeasurable({
        companyId,
        id: initial?.id,
        rev: initial?.rev,
        title: title.trim(),
        group: group.trim(), ...(scorecardEditing ? {sourceUrl: validUrl, assignedTeamIds: teamIds} : {}),
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
      {scorecardEditing && <><div className="field"><label htmlFor="m-source">Source material link <span className="faint">(optional)</span></label><input id="m-source" className="input" type="url" placeholder="https://…" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)}/><div className="field__hint">Link to the report, document, or spreadsheet used for this number.</div></div>
      <fieldset className="field team-assignments"><legend>Assigned teams</legend><div className="field__hint">Selected teams use this measurable and the same scores. The source team manages its definition.</div>{companies.map(option => <label key={option.id}><input type="checkbox" checked={teamIds.includes(option.id)} disabled={option.id === sourceTeamId || busy} onChange={event => setTeamIds(ids => event.target.checked ? [...ids,option.id] : ids.filter(id => id !== option.id))}/>{option.name}{option.id === sourceTeamId ? ' (source team)' : ''}</label>)}{teamIds.filter(id => !companies.some(option => option.id === id)).map(id => <label key={id}><input type="checkbox" checked disabled/>Existing team (not currently accessible)</label>)}</fieldset></>}
      <div className="row3">
        <div className="field">
          <label htmlFor="m-vt">Value</label>
          <select id="m-vt" className="select" value={valueType} onChange={e => setValueType(e.target.value)}>
            <option value="number">Number</option>
            <option value="currency">Dollars</option>
            <option value="percent">Percentage</option>
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
      <div className="field__hint">Display example: {fmtValue(valueType === 'percent' ? 0.30 : 1234.56,valueType)}. Formatting does not change stored values. Enter 0.30 for 0.30%.</div>
      <div className="field__hint">
        Red and green are worked out from the goal every time the scorecard is read — change a
        target and the history recolours to match, which is what you want.
      </div>
    </Modal>
  )
}

export function SectionsModal({rows, companyId, cadence, onClose, onSaved, focusSection}: {focusSection?:string; rows: Measurable[]; companyId: string; cadence: string; onClose: () => void; onSaved: () => void}) {
  const [sections, setSections] = useState(() => [...new Set([...rows].sort(compareMeasurables).map(row => row.group || ''))].map(name => ({name,newName:name})))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  function move(index: number, direction: number) {
    setSections(current => {const next=[...current]; [next[index],next[index+direction]]=[next[index+direction],next[index]]; return next})
  }
  async function save() {
    setBusy(true); setError(null)
    try {await saveScorecardSections({companyId,cadence,sections,revisions:rows.map(row => ({id:row.id,rev:row.rev}))}); onSaved()}
    catch (error: unknown) {setError(error instanceof Error ? error.message : 'Could not save sections.')}
    finally {setBusy(false)}
  }
  return <Modal title="Manage scorecard sections" onClose={onClose} footer={<><button className="btn" disabled={busy} onClick={onClose}>Cancel</button><button className="btn btn--primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save sections'}</button></>}>
    <p className="muted">Move sections up or down and change their names. Changes apply to this team's scorecard and cadence.</p><ErrorBanner error={error}/>
    <div className="section-editor">{sections.map((section,index) => <div className="section-editor__row" key={section.name}><label>Section name<input autoFocus={focusSection !== undefined && section.name === focusSection} className="input" aria-label={`Section name for ${section.name || 'Ungrouped'}`} value={section.newName} disabled={busy} placeholder="Ungrouped" onChange={event => setSections(current => current.map((value,i) => i === index ? {...value,newName:event.target.value} : value))}/></label><button className="btn btn--sm" aria-label={`Move ${section.newName || 'Ungrouped'} up`} disabled={busy || index === 0} onClick={() => move(index,-1)}>↑</button><button className="btn btn--sm" aria-label={`Move ${section.newName || 'Ungrouped'} down`} disabled={busy || index === sections.length - 1} onClick={() => move(index,1)}>↓</button></div>)}</div>
  </Modal>
}
