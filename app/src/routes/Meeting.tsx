import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  archiveMeeting, getMeeting, getMeetingOccurrence, markHeadlineRead, saveHeadline, saveIssue,
  saveTodo, setOccurrenceAttendees, setTodoStatus, solveIssue,
} from '../api'
import type { Meeting as MeetingT, MeetingOccurrence, Occurrence, Person } from '../api'
import { Avatar, Empty, ErrorBanner, Loading, Modal, dueClass, fmtDate, firstLast, todayIso } from '../lib/ui'
import { MeetingForm, freqLabel } from './Meetings'

/*
 * One private meeting. Pick a date; see who is invited to THAT date and the
 * meeting's own to-dos, issues and headlines. Open items carry forward from
 * date to date; closed ones stay on the date they were raised.
 *
 * Everything added here is created inside the meeting (meetingId + date), so
 * it never shows on the company lists or the company L10.
 */
export default function Meeting() {
  const { id = '' } = useParams()
  const [meeting, setMeeting] = useState<MeetingT | null>(null)
  const [occs, setOccs] = useState<Occurrence[]>([])
  const [roster, setRoster] = useState<Person[]>([])
  const [date, setDate] = useState<string>('')
  const [occ, setOcc] = useState<MeetingOccurrence | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [editing, setEditing] = useState(false)
  const [thisDate, setThisDate] = useState(false)

  const loadSeries = useCallback(() => {
    setErr(null)
    getMeeting(id)
      .then(r => {
        setMeeting(r.meeting); setOccs(r.occurrences); setRoster(r.roster)
        setDate(cur => {
          if (cur && r.occurrences.some(o => o.date === cur)) return cur
          const t = todayIso()
          const next = r.occurrences.find(o => o.date >= t)
          return (next || r.occurrences[r.occurrences.length - 1] || { date: '' }).date
        })
      })
      .catch(e => { if (e.code === 'NOT_FOUND') setNotFound(true); else setErr(e.message) })
  }, [id])

  const loadOcc = useCallback(() => {
    if (!date) { setOcc(null); return }
    getMeetingOccurrence(id, date).then(setOcc).catch(e => setErr(e.message))
  }, [id, date])

  useEffect(() => { loadSeries() }, [loadSeries])
  useEffect(() => { setOcc(null); loadOcc() }, [loadOcc])

  const reloadAll = () => { loadSeries(); loadOcc() }

  if (notFound) {
    return (
      <div className="page">
        <div className="card"><Empty title="Meeting not found">It may have been removed, or you are not invited to it.</Empty></div>
        <p><Link to="/meetings">Back to meetings</Link></p>
      </div>
    )
  }
  if (!meeting) return <div className="page"><ErrorBanner error={err} /><Loading what="Loading meeting" /></div>

  const archive = async () => {
    try { await archiveMeeting(meeting.id, !!meeting.archivedAt); reloadAll() } catch (e: any) { setErr(e.message) }
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <div className="page__sub"><Link to="/meetings">Meetings</Link></div>
          <h1>{meeting.title}</h1>
          <div className="page__sub">
            {freqLabel(meeting.recurrence)} · {meeting.companyName} · private to the people invited
          </div>
        </div>
        <div className="page__actions">
          <select className="select" style={{ width: 'auto' }} value={date} onChange={e => setDate(e.target.value)} aria-label="Date">
            {occs.length === 0 && <option value="">No dates in range</option>}
            {occs.map(o => (
              <option key={o.date} value={o.date}>{fmtDate(o.date)}{o.cancelled ? ' (cancelled)' : ''}</option>
            ))}
          </select>
          {meeting.canEdit && date && <button className="btn" onClick={() => setThisDate(true)}>This date only…</button>}
          {meeting.canEdit && <button className="btn" onClick={() => setEditing(true)}>Edit meeting</button>}
          {meeting.canEdit && <button className="btn" onClick={archive}>{meeting.archivedAt ? 'Restore' : 'Archive'}</button>}
        </div>
      </div>

      <ErrorBanner error={err} onDismiss={() => setErr(null)} />

      {!date ? (
        <div className="card"><Empty title="No dates">This meeting has no dates in the next or last eight weeks.</Empty></div>
      ) : !occ ? (
        <Loading what="Loading this date" />
      ) : (
        <>
          {occ.cancelled && (
            <div className="banner banner--warn" style={{ marginBottom: 12 }}>
              <div><div className="banner__b">Cancelled</div>This date is cancelled. Its items are still here.</div>
            </div>
          )}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card__head"><h2>Invited on {fmtDate(occ.date)}</h2></div>
            <div className="card__body" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {occ.attendees.map(a => (
                <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Avatar name={a.name} id={a.id} sm />{firstLast({ name: a.name }) || 'Unknown'}
                </span>
              ))}
            </div>
          </div>
          <TodosCard occ={occ} onChange={loadOcc} onError={setErr} />
          <IssuesCard occ={occ} onChange={loadOcc} onError={setErr} />
          <HeadlinesCard occ={occ} onChange={loadOcc} onError={setErr} />
        </>
      )}

      {editing && (
        <Modal title="Edit meeting" onClose={() => setEditing(false)}>
          <MeetingForm meeting={meeting} roster={roster} onDone={() => { setEditing(false); reloadAll() }} onCancel={() => setEditing(false)} />
        </Modal>
      )}
      {thisDate && (
        <Modal title={`Only ${fmtDate(date)}`} onClose={() => setThisDate(false)}>
          <ThisDateForm meeting={meeting} occ={occs.find(o => o.date === date)} roster={roster} date={date}
            onDone={() => { setThisDate(false); reloadAll() }} onCancel={() => setThisDate(false)} />
        </Modal>
      )}
    </div>
  )
}

/*
 * Google-Calendar "this event only": invite someone to one date, drop someone
 * from one date, or cancel one date. The regular list is untouched.
 */
function ThisDateForm({
  meeting, occ, roster, date, onDone, onCancel,
}: { meeting: MeetingT; occ?: Occurrence; roster: Person[]; date: string; onDone: () => void; onCancel: () => void }) {
  const series = useMemo(() => meeting.attendees.map(a => a.id), [meeting])
  const invited = useMemo(() => (occ ? occ.attendees.map(a => a.id) : series), [occ, series])
  const [ids, setIds] = useState<string[]>(invited)
  const [cancelled, setCancelled] = useState(!!occ?.cancelled)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const toggle = (id: string) => setIds(cur => (cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]))

  const submit = async () => {
    setBusy(true); setErr(null)
    try {
      await setOccurrenceAttendees({
        id: meeting.id, date, rev: meeting.rev, cancelled,
        add: ids.filter(x => !series.includes(x)),
        remove: series.filter(x => !ids.includes(x)),
      })
      onDone()
    } catch (e: any) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <>
      <ErrorBanner error={err} onDismiss={() => setErr(null)} />
      <div className="field__hint" style={{ marginBottom: 8 }}>
        Changes apply to {fmtDate(date)} only. Someone added here sees this date and nothing else.
      </div>
      <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 10 }}>
        {roster.map(p => (
          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <input type="checkbox" checked={ids.includes(p.id)} onChange={() => toggle(p.id)} />
            <Avatar name={p.name} id={p.id} sm />
            {firstLast(p)}
            {series.includes(p.id) ? '' : <span className="faint"> (this date only)</span>}
          </label>
        ))}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <input type="checkbox" checked={cancelled} onChange={e => setCancelled(e.target.checked)} />
        Cancel this date
      </label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn btn--primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save for this date'}</button>
      </div>
    </>
  )
}

interface CardProps { occ: MeetingOccurrence; onChange: () => void; onError: (m: string) => void }

function where(occ: MeetingOccurrence) {
  return { companyId: occ.meeting.companyId, meetingId: occ.meeting.id, occurrenceDate: occ.date }
}

function QuickAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (text: string) => Promise<void> }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async () => {
    if (!text.trim()) return
    setBusy(true)
    try { await onAdd(text.trim()); setText('') } finally { setBusy(false) }
  }
  return (
    <div style={{ display: 'flex', gap: 8, padding: 10 }}>
      <input className="input" value={text} placeholder={placeholder} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') go() }} />
      <button className="btn" onClick={go} disabled={busy || !text.trim()}>Add</button>
    </div>
  )
}

function TodosCard({ occ, onChange, onError }: CardProps) {
  const [owner, setOwner] = useState('')
  const add = async (title: string) => {
    const p = occ.attendees.find(a => a.id === owner)
    try { await saveTodo({ ...where(occ), title, ownerId: owner, ownerName: p ? p.name : '' }); onChange() }
    catch (e: any) { onError(e.message) }
  }
  const toggle = async (id: string, status: string, rev: number) => {
    try { await setTodoStatus(id, status === 'done' ? 'open' : 'done', rev); onChange() } catch (e: any) { onError(e.message) }
  }
  return (
    <div className="card card__body--flush" style={{ marginBottom: 12 }}>
      <div className="card__head"><h2>To-dos</h2></div>
      <div className="rows">
        {occ.todos.length === 0 && <Empty title="No to-dos">Anything decided here that someone has to do.</Empty>}
        {occ.todos.map(t => (
          <div className={'rowitem' + (t.status === 'done' ? ' rowitem--done' : '')} key={t.id}>
            <button className={'check' + (t.status === 'done' ? ' check--on' : '')} onClick={() => toggle(t.id, t.status, t.rev)}
              aria-label={t.status === 'done' ? 'Mark open' : 'Mark done'}>✓</button>
            <div className="rowitem__main">
              <div className="rowitem__title">{t.title}</div>
              <div className="rowitem__meta">
                <span>{firstLast({ name: t.ownerName }) || 'Unassigned'}</span>
                {t.dueDate && <span className={dueClass(t.dueDate, t.status === 'done')}>due {fmtDate(t.dueDate)}</span>}
                {t.occurrenceDate && t.occurrenceDate !== occ.date && <span>from {fmtDate(t.occurrenceDate)}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '10px 10px 0' }}>
        <select className="select" style={{ width: 'auto' }} value={owner} onChange={e => setOwner(e.target.value)} aria-label="Owner">
          <option value="">— Unassigned —</option>
          {occ.attendees.map(a => <option key={a.id} value={a.id}>{firstLast({ name: a.name })}</option>)}
        </select>
      </div>
      <QuickAdd placeholder="New to-do for this meeting" onAdd={add} />
    </div>
  )
}

function IssuesCard({ occ, onChange, onError }: CardProps) {
  const add = async (title: string) => {
    try { await saveIssue({ ...where(occ), title }); onChange() } catch (e: any) { onError(e.message) }
  }
  const solve = async (id: string, rev: number) => {
    try { await solveIssue(id, '', rev); onChange() } catch (e: any) { onError(e.message) }
  }
  return (
    <div className="card card__body--flush" style={{ marginBottom: 12 }}>
      <div className="card__head"><h2>Issues</h2></div>
      <div className="rows">
        {occ.issues.length === 0 && <Empty title="No issues">Something to identify, discuss and solve between the people here.</Empty>}
        {occ.issues.map(i => (
          <div className={'rowitem' + (i.status === 'solved' ? ' rowitem--done' : '')} key={i.id}>
            <div className="rowitem__main">
              <div className="rowitem__title">{i.title}</div>
              <div className="rowitem__meta">
                <span>{firstLast({ name: i.createdByName })}</span>
                {i.status === 'solved' && <span>solved</span>}
              </div>
            </div>
            <div className="rowitem__end">
              {i.status === 'open' && <button className="btn" onClick={() => solve(i.id, i.rev)}>Solved</button>}
            </div>
          </div>
        ))}
      </div>
      <QuickAdd placeholder="New issue for this meeting" onAdd={add} />
    </div>
  )
}

function HeadlinesCard({ occ, onChange, onError }: CardProps) {
  const add = async (body: string) => {
    try { await saveHeadline({ ...where(occ), body, type: 'employee' }); onChange() } catch (e: any) { onError(e.message) }
  }
  const mark = async (id: string, read: boolean) => {
    try { await markHeadlineRead([id], read); onChange() } catch (e: any) { onError(e.message) }
  }
  return (
    <div className="card card__body--flush">
      <div className="card__head"><h2>Headlines</h2></div>
      <div className="rows">
        {occ.headlines.length === 0 && <Empty title="No headlines">News for the people in this meeting.</Empty>}
        {occ.headlines.map(h => (
          <div className={'rowitem' + (h.readDate ? ' rowitem--done' : '')} key={h.id}>
            <button className={'check' + (h.readDate ? ' check--on' : '')} onClick={() => mark(h.id, !!h.readDate)}
              aria-label={h.readDate ? 'Mark unread' : 'Mark read'}>✓</button>
            <div className="rowitem__main">
              <div className="rowitem__title">{h.body}</div>
              <div className="rowitem__meta"><span>{firstLast({ name: h.createdByName })}</span></div>
            </div>
          </div>
        ))}
      </div>
      <QuickAdd placeholder="New headline for this meeting" onAdd={add} />
    </div>
  )
}
