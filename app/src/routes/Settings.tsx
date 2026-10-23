import { useEffect, useState } from 'react'
import { saveSettings } from '../api'
import type { AdminTeam } from '../api'
import { ErrorBanner } from '../lib/ui'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/*
 * One team's settings. Each Hope Group company is a separate legal entity, so
 * the fiscal year and week end are per team rather than org-wide.
 *
 * ADMINS ONLY (ticket #269): this renders inside the Admin page, which only the
 * three EOS admins see, and the endpoint refuses saveSettings for anyone else.
 * An admin can set any team's settings without being on the team.
 */
export default function SettingsForm({ team, onSaved }: { team: AdminTeam; onSaved: () => void }) {
  const st = team.settings

  const [displayName, setDisplayName] = useState(st.displayName)
  const [fyStart, setFyStart] = useState(st.fiscalYearStartMonth)
  const [weekEndsOn, setWeekEndsOn] = useState(st.weekEndsOn)
  const [meetingDay, setMeetingDay] = useState(st.meetingDay)
  const [eosActive, setEosActive] = useState(st.eosActive)
  const [cadences, setCadences] = useState<string[]>(st.scorecardCadences)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Switching teams in the picker loads that team's values into the form.
  useEffect(() => {
    setDisplayName(st.displayName); setFyStart(st.fiscalYearStartMonth); setWeekEndsOn(st.weekEndsOn)
    setMeetingDay(st.meetingDay); setEosActive(st.eosActive); setCadences(st.scorecardCadences)
    setErr(null)
  }, [team.id, st.rev]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setBusy(true); setErr(null); setSaved(false)
    try {
      await saveSettings({
        companyId: team.id,
        rev: st.rev,
        displayName: displayName.trim() || team.name,
        fiscalYearStartMonth: fyStart,
        weekEndsOn,
        meetingDay,
        eosActive,
        scorecardCadences: cadences.length ? cadences : ['weekly'],
      })
      setSaved(true)
      onSaved()
    } catch (e: any) {
      setErr(e.message || 'Could not save settings.')
    } finally {
      setBusy(false)
    }
  }

  const toggleCadence = (c: string) => {
    setCadences(cs => (cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]))
  }

  return (
    <div className="card">
      <div className="card__head">
        <h2>{team.name}</h2>
        <span className="pill pill--muted">{team.kind === 'company' ? 'company team' : `team on ${team.homeName}`}</span>
      </div>
      <div className="card__body">
        <ErrorBanner error={err} onDismiss={() => setErr(null)} />
        {saved && (
          <div className="banner" style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>
            <div><span className="banner__b">Saved.</span> Period keys are recomputed from these on the next read.</div>
          </div>
        )}

        <div className="field">
          <label htmlFor="s-name">Display name</label>
          <input id="s-name" className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} />
        </div>

        <div className="row2">
          <div className="field">
            <label htmlFor="s-fy">Fiscal year starts</label>
            <select id="s-fy" className="select" value={fyStart} onChange={e => setFyStart(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <div className="field__hint">Quarters are labelled from this, so changing it relabels every rock.</div>
          </div>
          <div className="field">
            <label htmlFor="s-we">Weeks end on</label>
            <select id="s-we" className="select" value={weekEndsOn} onChange={e => setWeekEndsOn(Number(e.target.value))}>
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
            <div className="field__hint">Which day closes a scorecard week.</div>
          </div>
        </div>

        <div className="row2">
          <div className="field">
            <label htmlFor="s-md">Level 10 day</label>
            <select id="s-md" className="select" value={meetingDay} onChange={e => setMeetingDay(Number(e.target.value))}>
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Scorecard cadences</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, paddingTop: 5 }}>
              {['weekly', 'monthly', 'quarterly', 'annual'].map(c => (
                <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={cadences.includes(c)}
                    onChange={() => toggleCadence(c)}
                    disabled={c === 'weekly'}
                  />
                  {c[0].toUpperCase() + c.slice(1)}
                </label>
              ))}
            </div>
            <div className="field__hint">Weekly is always on. The others each add a tab to the scorecard.</div>
          </div>
        </div>

        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 520 }}>
            <input type="checkbox" checked={eosActive} onChange={e => setEosActive(e.target.checked)} />
            EOS is active for this team
          </label>
          <div className="field__hint">
            Turn this off for a team that shouldn't be in use — it hides it rather than deleting anything.
          </div>
        </div>

        <button className="btn btn--primary" onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </div>
  )
}
