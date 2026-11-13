import {compareNames, compareDates, isOverdue} from '../lib/listModel'
import {useToday} from '../lib/useToday'
import QuickCreateButtons from '../components/QuickCreateButtons'
import FollowupContext from '../meetings/FollowupContext'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getTodos, saveTodo, setTodoStatus } from '../api'
import type { Todo } from '../api'
import { useApp } from '../state'
import {
  Avatar, PersonName, Empty, ErrorBanner, Loading, Modal, OwnerPicker, RowMenu,
  dueClass, fmtDate, plusDaysIso,
} from '../lib/ui'
import { DropToIssueModal } from '../components/DropToIssue'

/*
 * Seven-day action items. The server owns the +7 default, because that horizon is
 * doctrine rather than a preference — anything longer should be a Rock or a
 * milestone, and the default is where that discipline gets enforced.
 *
 * Personal action items are private to their owner and never appear in the L10.
 */
export default function Todos({embedded=false,companyId}:{embedded?:boolean;companyId?:string}) {
  const { company, team:currentTeam,teams, me } = useApp()
  const targetCompanyId=companyId||company.id
  const team=teams?.[targetCompanyId]||(targetCompanyId===company.id?currentTeam:[])
  const [mine, setMine] = useState(false)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [sort, setSort] = useState('due')
  const today = useToday()
  const [showDone, setShowDone] = useState(false)
  const [trackRange,setTrackRange]=useState<import('../../../platform/todoTrackRecord').TrackRecordRange>('3m')
  const requestVersion=useRef(0)
  const [trackRecord,setTrackRecord]=useState<import('../../../platform/todoTrackRecord').TrackRecordRow[]|null>(null)
  const [rows, setRows] = useState<Todo[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<Todo | 'new' | null>(null)
  const [dropFor, setDropFor] = useState<Todo | null>(null)

  const load = useCallback(() => {
    const version=++requestVersion.current
    setErr(null)
    const request=embedded?getTodos(targetCompanyId,mine,showDone?undefined:'open',trackRange,true):getTodos(targetCompanyId,mine,showDone?undefined:'open',trackRange)
    request
      .then(r => {if(version!==requestVersion.current)return;setRows(embedded?r.rows.filter(row=>!row.personal&&!row.meetingId):r.rows);setTrackRecord(r.trackRecord?.rows || null)})
      .catch(e => {if(version===requestVersion.current)setErr(e.message)})
  }, [targetCompanyId, mine, showDone,trackRange,embedded])

  useEffect(() => { setRows(null); setTrackRecord(null); load();if(!embedded)return;const timer=window.setInterval(load,10000);return()=>window.clearInterval(timer) }, [load,embedded])

  const toggle = async (t: Todo) => {
    const next = t.status === 'done' ? 'open' : 'done'
    // Optimistic — flip locally, then reconcile from the server's copy.
    setRows(rs => rs ? rs.map(x => (x.id === t.id ? { ...x, status: next } as Todo : x)) : rs)
    try { await setTodoStatus(t.id, next, t.rev); load() }
    catch (e: any) { setErr(e.message); load() }
  }

  const visible = (rows || []).filter(row => !overdueOnly || isOverdue(row, today)).sort((a, b) => sort === 'owner' ? compareNames(a.ownerName, b.ownerName) : sort === 'owner-desc' ? compareNames(b.ownerName, a.ownerName) : compareDates(a.dueDate, b.dueDate, sort === 'due-desc'))
  const open = visible.filter(row => row.status === 'open')
  const done = visible.filter(row => row.status === 'done')

  return (
    <div className={embedded?"meeting-action-items":"page"}>
      <div className="page__head">
        <div>
          {!embedded&&<h1>Action Items</h1>}
          <div className="page__sub">
            Seven-day commitments. If it takes longer than that, it wants to be a Rock.
          </div>
        </div>

      </div>

      <section className="action-track-record" aria-label="Action item on-time rates">
        <div className="action-track-record__head"><strong>On-time completion</strong><div className="seg" aria-label="Completion rate period">{([['all','All time'],['3m','Last 3 months'],['1m','Last 1 month']] as const).map(([value,label])=><button key={value} className={trackRange===value?'active':''} aria-pressed={trackRange===value} onClick={()=>setTrackRange(value)}>{label}</button>)}</div></div>
        <p className="muted">Based on due dates. Includes overdue open items. — means no scored items.</p>
        <div className="action-track-record__members">{(trackRecord || team.map(member=>({id:member.id,name:member.name,onTime:0,scored:0,unscored:0,rate:null}))).map(member=><div className="action-track-record__member" key={member.id} title={`${member.name}: ${member.onTime} on time / ${member.scored} scored action items. ${member.unscored} unscored. Includes archived completions; excludes personal and private meeting items.`}><Avatar name={member.name} id={member.id}/><span className="action-track-record__name"><PersonName name={member.name} id={member.id}/></span><strong className="mono">{member.rate===null?'—':`${Math.round(member.rate*100)}%`}</strong></div>)}</div>
      </section>

      <ErrorBanner error={err} onDismiss={() => setErr(null)} />

      <div className="list-toolbar action-item-toolbar" aria-label="Action item filters and sorting"><div className="seg" role="group" aria-label="Sort action items">{[{key:'due',reverse:'due-desc',label:'Date'},{key:'owner',reverse:'owner-desc',label:'Name'}].map(option=><button type="button" key={option.key} aria-pressed={sort===option.key||sort===option.reverse} title={option.key==='due'?(sort==='due-desc'?'Latest due date first':'Earliest due date first'):(sort==='owner-desc'?'Owner Z–A':'Owner A–Z')} onClick={()=>setSort(current=>current===option.key?option.reverse:option.key)}>{option.label}{(sort===option.key||sort===option.reverse)&&<span aria-hidden="true"> {sort===option.key?'↑':'↓'}</span>}</button>)}</div>
          <div className="seg" role="group" aria-label="Scope">
            <button aria-pressed={!mine} onClick={() => setMine(false)}>Team</button>
            <button aria-pressed={mine} onClick={() => setMine(true)}>Mine</button>
          </div>
          <button className="btn" aria-pressed={overdueOnly} onClick={() => setOverdueOnly(value => !value)}>Overdue</button>
          <button className="btn" aria-pressed={showDone} onClick={() => setShowDone(s => !s)}>
            {showDone ? 'Hide done' : 'Show done'}
          </button>
          <QuickCreateButtons companyId={targetCompanyId} onSaved={load}/>
      </div>

      {!rows ? (
        <Loading what="Loading action items" />
      ) : rows.length === 0 ? (
        <div className="card">
          <Empty title={mine ? 'Nothing on your list' : 'No open action items'}>
            Most action items are created by solving an issue in the L10 — that's the point of the list.
          </Empty>
        </div>
      ) : (
        <>
          <div className="card card__body--flush">
            <div className="rows">
              {open.map(t => (
                <TodoRow key={t.id} todo={t} onToggle={() => toggle(t)} onEdit={() => setEditing(t)} onDrop={() => setDropFor(t)} />
              ))}
              {open.length === 0 && <Empty title={overdueOnly ? 'No overdue action items match this scope' : "Everything's done"} />}
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
          companyId={targetCompanyId}
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
  const today = useToday()
  const overdue = isOverdue(todo,today)
  const isDone = todo.status === 'done'
  return (
    <div className={'rowitem action-item-row' + (overdue ? ' action-item-row--overdue' : '') + (isDone ? ' rowitem--done' : '')}>
      <button
        className={'check' + (isDone ? ' check--on' : '')}
        disabled={todo.readOnly} onClick={onToggle}
        aria-label={isDone ? `Mark "${todo.title}" not done` : `Mark "${todo.title}" done`}
      >
        ✓
      </button>
      <div className="rowitem__owner"><Avatar name={todo.ownerName} id={todo.ownerId} sm/><PersonName name={todo.ownerName} id={todo.ownerId}/></div>
      <div className="rowitem__main">
        <div className="rowitem__title">
          {onEdit ? <button type="button" className="rowitem__title-link" onClick={onEdit}>{todo.title}</button> : todo.title}<FollowupContext hideOwner item={todo}/>
          {todo.personal && <span className="pill pill--muted" title="Only you can see this">personal</span>}
          {todo.origin && todo.origin.kind === 'issue' && (
            <span className="pill pill--muted" title={todo.origin.label}>from issue</span>
          )}
        </div>
        <div className="rowitem__meta">
          {todo.dueDate && (
            <span className={dueClass(todo.dueDate, isDone)}>
              {todo.dueDate < plusDaysIso(0) && !isDone ? 'overdue — ' : 'due '}{fmtDate(todo.dueDate)}
            </span>
          )}
          {showCompany && todo.companyName && <span className="faint">{todo.companyName}</span>}
        </div>
      </div>
      {!todo.readOnly&&(onEdit || onDrop) && (
        <div className="rowitem__end">
          <RowMenu>
            {close => (
              <>
                {onEdit && <button onClick={() => { close(); onEdit() }}>Edit action item</button>}
                {onDrop && <button onClick={() => { close(); onDrop() }}>Drop to Issues</button>}
              </>
            )}
          </RowMenu>
        </div>
      )}
    </div>
  )
}

export function TodoModal({
  initial, companyId, team, defaultOwnerId, defaultOwnerName, onClose, onSaved, teamSelect,
}: {
  teamSelect?:React.ReactNode
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

  const readOnly = !!initial?.readOnly
  const submit = async () => {
    if (readOnly) return
    if (!title.trim()) { setErr('A action item needs a title.'); return }
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
      title={readOnly ? 'Action item details' : initial ? 'Edit action item' : 'New action item'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          {!readOnly && <button className="btn btn--primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>}
        </>
      }
    >
      <ErrorBanner error={err} onDismiss={() => setErr(null)} />{teamSelect}
      <fieldset className="edit-fields" disabled={readOnly || busy}>
      <div className="field">
        <label htmlFor="t-title">Action Item</label>
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
      </fieldset>
    </Modal>
  )
}
