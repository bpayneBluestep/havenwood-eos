import { useState } from 'react'
import { saveSettings } from '../api'
import { useApp } from '../state'
import { Avatar, ErrorBanner, firstLast } from '../lib/ui'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/*
 * Company settings. Each Hope Group company is a separate legal entity, so the
 * fiscal year and week end are per company rather than org-wide.
 *
 * Gated on global super, which is the only admin distinction the model has:
 * everyone with the EOS box in a unit can edit everything else in their company.
 */
export default function Settings() {
  const { company, companies, me, team, reload, multiCompany } = useApp()
  const st = company.settings

  const [displayName, setDisplayName] = useState(st.displayName)
  const [fyStart, setFyStart] = useState(st.fiscalYearStartMonth)
  const [weekEndsOn, setWeekEndsOn] = useState(st.weekEndsOn)
  const [meetingDay, setMeetingDay] = useState(st.meetingDay)
  const [eosActive, setEosActive] = useState(st.eosActive)
  const [cadences, setCadences] = useState<string[]>(st.scorecardCadences)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  if (!me.isSuper) {
    return (
      <div className="page">
        <div className="page__head"><div><h1>Settings</h1></div></div>
        <div className="banner banner--warn">
          <div>
            <div className="banner__b">Company settings are administrator-only.</div>
            Everything else in Traction is open to your whole leadership team — rocks, issues,
            to-dos, measurables and headlines.
          </div>
        </div>
        <TeamCard team={team} />
      </div>
    )
  }

  const submit = async () => {
    setBusy(true); setErr(null); setSaved(false)
    try {
      await saveSettings({
        companyId: company.id,
        rev: st.rev,
        displayName: displayName.trim() || company.name,
        fiscalYearStartMonth: fyStart,
        weekEndsOn,
        meetingDay,
        eosActive,
        scorecardCadences: cadences.length ? cadences : ['weekly'],
      })
      setSaved(true)
      reload()
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
    <div className="page">
      <div className="page__head">
        <div>
          <h1>Settings</h1>
          <div className="page__sub">
            {multiCompany ? 'These apply to the company selected above.' : 'These apply to your company.'}
          </div>
        </div>
      </div>

      <ErrorBanner error={err} onDismiss={() => setErr(null)} />
      {saved && (
        <div className="banner" style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>
          <div><span className="banner__b">Saved.</span> Period keys are recomputed from these on the next read.</div>
        </div>
      )}

      <div className="card">
        <div className="card__head"><h2>{company.settings.displayName || company.name}</h2></div>
        <div className="card__body">
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
              EOS is active for this company
            </label>
            <div className="field__hint">
              Turn this off for a company that shouldn't have an instance — it hides it rather than
              deleting anything.
            </div>
          </div>

          <button className="btn btn--primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>

      <TeamCard team={team} />

      <div className="card">
        <div className="card__head"><h2>Companies you can see</h2></div>
        <div className="card__body--flush">
          <div className="rows">
            {companies.map(c => (
              <div className="rowitem" key={c.id}>
                <div className="rowitem__main">
                  <div className="rowitem__title">
                    {c.settings.displayName || c.name}
                    {c.id === company.id && <span className="pill pill--muted">selected</span>}
                    {!c.settings.eosActive && <span className="pill pill--amber">inactive</span>}
                  </div>
                  <div className="rowitem__meta">
                    <span className="mono faint">{c.id}</span>
                    <span>{c.periods.week} · {c.periods.quarter}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/*
 * The roster is DERIVED from the EOS security group, never stored here — so it
 * can't drift from the thing that actually controls access. This card is
 * read-only on purpose: access is granted by checking the EOS box on someone's
 * Employment Info record, and it self-revokes when they're terminated.
 */
function TeamCard({ team }: { team: { id: string; name: string; displayName: string; email: string }[] }) {
  return (
    <div className="card">
      <div className="card__head">
        <h2>Leadership team</h2>
        <span className="card__end mono faint">{team.length}</span>
      </div>
      <div className="card__body--flush">
        {team.length === 0 ? (
          <div className="empty">
            <div className="empty__t">Nobody has EOS access in your unit yet</div>
            <div className="empty__d">
              Access is granted by checking the <strong>EOS</strong> box under Security Groups on
              someone's Staff — Employment Info record. They appear here automatically, and drop off
              automatically when they're marked Former Staff.
            </div>
          </div>
        ) : (
          <div className="rows">
            {team.map(p => (
              <div className="rowitem" key={p.id}>
                <Avatar name={p.name} id={p.id} />
                <div className="rowitem__main">
                  <div className="rowitem__title">{firstLast(p)}</div>
                  <div className="rowitem__meta">{p.email && <span>{p.email}</span>}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
