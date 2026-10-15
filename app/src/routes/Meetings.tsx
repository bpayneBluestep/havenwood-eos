import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getMeetings, saveMeeting } from '../api'
import type { Meeting, MeetingFreq, Person, Recurrence } from '../api'
import { useApp } from '../state'
import { Avatar, Empty, ErrorBanner, Loading, Modal, fmtDate, firstLast, todayIso } from '../lib/ui'

/*
 * Private meetings — 1:1s and huddles. Unlike the company L10, a meeting and
 * everything raised in it is visible to its attendees only, even when other
 * people can see the same company. The server enforces that; this page only
 * lists what it was given.
 */
export default function Meetings() {
  const { company } = useApp()
  const [rows, setRows] = useState<Meeting[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const nav = useNavigate()

  const load = useCallback(() => {
    setErr(null)
    getMeetings(company.id, showArchived).then(r => setRows(r.rows)).catch(e => setErr(e.message))
  }, [company.id, showArchived])

  useEffect(() => { setRows(null); load() }, [load])

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1>Meetings</h1>
          <div className="page__sub">
            1:1s and huddles. Only the people invited can see a meeting and what was raised in it.
          </div>
        </div>
        <div className="page__actions">
          <button className="btn" aria-pressed={showArchived} onClick={() => setShowArchived(a => !a)}>
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
          <button className="btn btn--primary" onClick={() => setAdding(true)}>+ Meeting</button>
        </div>
      </div>

      <ErrorBanner error={err} onDismiss={() => setErr(null)} />

      {!rows ? (
        <Loading what="Loading meetings" />
      ) : rows.length === 0 ? (
        <div className="card">
          <Empty title="No meetings yet">
            Start a 1:1 or a huddle. Its to-dos, issues and headlines stay with the people in it.
          </Empty>
        </div>
      ) : (
        <div className="card card__body--flush">
          <div className="rows">
            {rows.map(m => (
              <div className={'rowitem' + (m.archivedAt ? ' rowitem--done' : '')} key={m.id}>
                <div className="rowitem__main">
                  <div className="rowitem__title">
                    <Link to={`/meetings/${encodeURIComponent(m.id)}`}>{m.title}</Link>
                    <span className="pill pill--muted">{freqLabel(m.recurrence)}</span>
                  </div>
                  <div className="rowitem__meta">
                    <span>{m.attendees.map(a => firstLast({ name: a.name }) || 'Unknown').join(', ')}</span>
                    {m.nextDate && <span>next {fmtDate(m.nextDate)}</span>}
                    {m.archivedAt && <span>archived</span>}
                  </div>
                </div>
                <div className="rowitem__end">
                  {m.attendees.slice(0, 4).map(a => <Avatar key={a.id} name={a.name} id={a.id} sm />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {adding && (
        <Modal title="New meeting" onClose={() => setAdding(false)}>
          <MeetingForm
            onDone={m => { setAdding(false); nav(`/meetings/${encodeURIComponent(m.id)}`) }}
            onCancel={() => setAdding(false)}
          />
        </Modal>
      )}
    </div>
  )
}

export function freqLabel(r: Recurrence): string {
  if (r.freq === 'weekly') return 'Weekly'
  if (r.freq === 'biweekly') return 'Every 2 weeks'
  if (r.freq === 'monthly') return 'Monthly'
  return 'One-time'
}

/*
 * Create or edit a meeting series. Attendees come from the company roster
 * (everyone with access to this company); the server re-checks every one.
 */
export function MeetingForm({
  meeting, roster, onDone, onCancel,
}: {
  meeting?: Meeting
  roster?: Person[]
  onDone: (m: Meeting) => void
  onCancel?: () => void
}) {
  const { company, team, me } = useApp()
  const people = roster || team
  const [title, setTitle] = useState(meeting?.title || '')
  const [freq, setFreq] = useState<MeetingFreq>(meeting?.recurrence.freq || 'weekly')
  const [start, setStart] = useState(meeting?.recurrence.start || todayIso())
  const [until, setUntil] = useState(meeting?.recurrence.until || '')
  const [ids, setIds] = useState<string[]>(
    meeting ? meeting.attendees.map(a => a.id) : (me.id ? [me.id] : []),
  )
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const toggle = (id: string) => setIds(cur => (cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]))

  const submit = async () => {
    if (!title.trim()) { setErr('A meeting needs a title.'); return }
    if (!ids.length) { setErr('Invite at least one person.'); return }
    setBusy(true); setErr(null)
    try {
      const m = await saveMeeting({
        id: meeting?.id,
        companyId: meeting ? undefined : company.id,
        title: title.trim(),
        attendeeIds: ids,
        recurrence: { freq, start, until },
        rev: meeting?.rev,
      })
      onDone(m)
    } catch (e: any) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <>
      <ErrorBanner error={err} onDismiss={() => setErr(null)} />
      <div className="field">
        <label htmlFor="m-title">Title</label>
        <input id="m-title" className="input" autoFocus value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Jake / Jessi 1:1" />
      </div>
      <div className="field">
        <label htmlFor="m-freq">Repeats</label>
        <select id="m-freq" className="select" value={freq} onChange={e => setFreq(e.target.value as MeetingFreq)}>
          <option value="none">Does not repeat</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Every 2 weeks</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="m-start">{freq === 'none' ? 'Date' : 'First meeting'}</label>
          <input id="m-start" type="date" className="input" value={start} onChange={e => setStart(e.target.value)} />
        </div>
        {freq !== 'none' && (
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="m-until">Ends (optional)</label>
            <input id="m-until" type="date" className="input" value={until} onChange={e => setUntil(e.target.value)} />
          </div>
        )}
      </div>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
        <legend style={{ fontWeight: 600, marginBottom: 6 }}>Attendees</legend>
        <div className="field__hint" style={{ marginBottom: 6 }}>
          Only the people checked here can see this meeting and anything raised in it.
        </div>
        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
          {people.map(p => (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <input type="checkbox" checked={ids.includes(p.id)} onChange={() => toggle(p.id)} />
              <Avatar name={p.name} id={p.id} sm />
              {firstLast(p)}
            </label>
          ))}
        </div>
      </fieldset>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {onCancel && <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>}
        <button className="btn btn--primary" onClick={submit} disabled={busy || !title.trim()}>
          {busy ? 'Saving…' : meeting ? 'Save meeting' : 'Create meeting'}
        </button>
      </div>
    </>
  )
}
