import LiveMeetings from '../meetings/LiveMeetings'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getMeetings, saveMeeting, getMeetingTypes } from '../api'
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
  const [liveOpen,setLiveOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [scheduledOpen,setScheduledOpen]=useState(false)
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
            Start or join one live meeting for this team. Open Scheduled meetings to manage private meeting dates.
          </div>
        </div>
        {!liveOpen && <div className="page__actions">
          <button className="btn" onClick={()=>setScheduledOpen(true)}>Scheduled meetings</button>
          <button className="btn" aria-pressed={showArchived} onClick={() => setShowArchived(a => !a)}>
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
          <button className="btn btn--primary" onClick={() => setAdding(true)}>+ Schedule meeting</button>
        </div>}
      </div>

      <ErrorBanner error={err} onDismiss={() => setErr(null)} />

      <LiveMeetings key={company.id} companyId={company.id} onActiveChange={setLiveOpen}/>
      {scheduledOpen && <Modal title="Scheduled private meetings" onClose={()=>setScheduledOpen(false)}>
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

      </Modal>}

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
  const { company, team, companies, teams } = useApp()
  const [selectedTeamId,setSelectedTeamId]=useState(meeting?.companyId || company.id)
  const people=meeting ? (roster || teams?.[selectedTeamId] || team) : (teams?.[selectedTeamId] || (selectedTeamId===company.id?team:[]))
  const [types,setTypes]=useState<import('../../../platform/meetingTypes').MeetingType[]|null>(null)
  const [meetingTypeId,setMeetingTypeId]=useState(meeting?.meetingTypeId || '')
  const selectedType=types?.find(type=>type.id===meetingTypeId)
  const title=selectedType?.name || (meeting && !meetingTypeId ? meeting.title : '')
  useEffect(()=>{let active=true;setTypes(null);getMeetingTypes(selectedTeamId).then(catalog=>{if(active){setTypes(catalog.types);setMeetingTypeId(current=>catalog.types.some(type=>type.id===current)?current:(meeting&&!meeting.meetingTypeId?'':catalog.types.find(type=>type.id==='l10')?.id || catalog.types[0]?.id || ''))}}).catch(error=>{if(active)setErr(error.message)});return()=>{active=false}},[selectedTeamId,meeting])
  const [freq, setFreq] = useState<MeetingFreq>(meeting?.recurrence.freq || 'weekly')
  const [start, setStart] = useState(meeting?.recurrence.start || todayIso())
  const [until, setUntil] = useState(meeting?.recurrence.until || '')
  const [ids, setIds] = useState<string[]>(
    meeting ? meeting.attendees.map(a => a.id) : people.map(person=>person.id),
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
        companyId: meeting ? undefined : selectedTeamId,
        meetingTypeId:meetingTypeId || undefined,
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
      <div className="row2"><div className="field"><label htmlFor="schedule-team">Team</label><select id="schedule-team" aria-label="Meeting team" className="select" value={selectedTeamId} disabled={!!meeting||busy} onChange={event=>{const id=event.target.value;setSelectedTeamId(id);setIds((teams?.[id] || (id===company.id?team:[])).map(person=>person.id));setMeetingTypeId('');setErr(null)}}>{companies.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></div><div className="field"><label htmlFor="schedule-type">Meeting type</label><select id="schedule-type" aria-label="Scheduled meeting type" className="select" value={meetingTypeId} disabled={!types||busy} onChange={event=>setMeetingTypeId(event.target.value)}>{meeting&&!meeting.meetingTypeId&&<option value="">Existing custom meeting</option>}{!types&&<option value="">Loading meeting types…</option>}{types?.map(type=><option key={type.id} value={type.id}>{type.name}</option>)}</select></div></div>
      <div className="field"><label htmlFor="m-title">Title</label><input id="m-title" className="input" value={title} readOnly/><div className="field__hint">The title comes from the selected meeting type.</div></div>
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
          The selected team’s members are selected automatically for a new meeting. Adjust the attendees as needed. Only checked people can see this scheduled meeting and its private follow-ups.
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
        <button className="btn btn--primary" onClick={submit} disabled={busy || !types || !title.trim()}>
          {busy ? 'Saving…' : meeting ? 'Save meeting' : 'Create meeting'}
        </button>
      </div>
    </>
  )
}
