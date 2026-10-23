import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { bootstrap, ApiError } from './api'
import type { Bootstrap, CompanyBrief, Me, Person } from './api'
import { Login, NoAccess } from './Login'
import Admin from './routes/Admin'

/*
 * One bootstrap call carries the whole app shell: who I am, which TEAMS I'm on
 * (ticket #269 — still called `companies`, because a company team's id is its
 * company's id), and each team's members, used only to populate pickers — never
 * to gate.
 *
 * The selected team lives here because most people are on exactly one and
 * should never learn the concept exists.
 */

interface Ctx {
  me: Me
  companies: CompanyBrief[]
  company: CompanyBrief
  team: Person[]
  multiCompany: boolean
  setCompanyId: (id: string) => void
  reload: () => void
  /** ownerId -> display name, via the derived roster. '' when unknown. */
  nameOf: (id: string) => string
}

const AppCtx = createContext<Ctx | null>(null)

export function useApp(): Ctx {
  const v = useContext(AppCtx)
  if (!v) throw new Error('useApp outside AppProvider')
  return v
}

/** Remembered per browser so a corporate user does not re-pick every visit. */
const LS_KEY = 'hw-eos-company'

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Bootstrap | null>(null)
  const [err, setErr] = useState<ApiError | null>(null)
  const [companyId, setCompanyIdRaw] = useState<string>(() => {
    try { return localStorage.getItem(LS_KEY) || '' } catch { return '' }
  })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let live = true
    setErr(null)
    bootstrap()
      .then(d => { if (live) setData(d) })
      .catch(e => { if (live) setErr(e instanceof ApiError ? e : new ApiError(String(e))) })
    return () => { live = false }
  }, [nonce])

  const setCompanyId = useCallback((id: string) => {
    setCompanyIdRaw(id)
    try { localStorage.setItem(LS_KEY, id) } catch { /* private mode */ }
  }, [])

  const reload = useCallback(() => setNonce(n => n + 1), [])

  /*
   * Which company to show, in order of preference:
   *   1. the one this browser last chose
   *   2. the one in the caller's OWN unit — for an operating-unit leader that is
   *      the only one there is, and for a corporate leader it means corporate
   *      rather than whichever company happens to sort first
   *   3. any active one, then anything at all, so a fully deactivated org still
   *      renders instead of crashing
   * This mirrors the server's own default; the two must agree or a corporate
   * user sees one company's header above another company's data.
   */
  const company = useMemo(() => {
    if (!data || !data.companies.length) return null
    const saved = data.companies.find(c => c.id === companyId)
    if (saved) return saved
    const home = data.me.unitId
    return (
      data.companies.find(c => c.unitId === home && c.settings.eosActive) ||
      data.companies.find(c => c.unitId === home) ||
      data.companies.find(c => c.settings.eosActive) ||
      data.companies[0]
    )
  }, [data, companyId])

  if (err && err.needsLogin) {
    return <Login onSignedIn={d => { setErr(null); setData(d) }} onNoAccess={() => setErr(new ApiError('', { code: 'AUTH_REQUIRED', noAccess: true }))} />
  }
  if (err && err.noAccess) {
    return <NoAccess message={err.message} onSignedOut={() => { setData(null); setErr(new ApiError('', { needsLogin: true })) }} />
  }
  if (err) return <GateError err={err} onRetry={reload} />

  if (!data) {
    return (
      <div className="loading">
        <span className="spinner" aria-hidden="true" />
        <span>Loading Traction…</span>
      </div>
    )
  }

  if (!company) {
    // An admin who isn't on any team (ticket #269): they configure Traction but
    // see no team data, so the only thing to show them is Admin itself.
    if (data.me.isAdmin) {
      return (
        <div className="main">
          <div className="banner banner--warn" style={{ margin: '16px 16px 0' }}>
            <div>
              <div className="banner__b">You aren't on any team.</div>
              As an admin you can set teams up, but you only see a team's scorecard, rocks and
              meetings once you add yourself to it.
            </div>
          </div>
          <Admin onChanged={reload} />
        </div>
      )
    }
    return (
      <div className="page">
        <div className="banner banner--warn">
          <div>
            <div className="banner__b">You aren't on a Traction team yet.</div>
            Ask a Traction admin to add you to your team.
          </div>
        </div>
      </div>
    )
  }

  // Owner pickers are per team: only its members.
  const team = (data.teams && data.teams[company.id]) || data.team

  const nameOf = (id: string) => {
    if (!id) return ''
    const hit = team.find(p => p.id === id)
    if (hit) return hit.name
    return data.me.id === id ? data.me.name : ''
  }

  const value: Ctx = {
    me: data.me,
    companies: data.companies,
    company,
    team,
    multiCompany: data.multiCompany,
    setCompanyId,
    reload,
    nameOf,
  }

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

/*
 * Anything that isn't "signed out" (our own sign-in form) or "no access": the
 * endpoint broke or isn't published.
 */
function GateError({ err, onRetry }: { err: ApiError; onRetry: () => void }) {
  const notPublished = err.code === 'NOT_PUBLISHED'
  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 560, margin: '8vh auto' }}>
        <div className="card__head"><h2>Traction could not load</h2></div>
        <div className="card__body">
          <div className="banner banner--error" style={{ marginBottom: 12 }}>
            <div>
              <div className="banner__b">{err.code}</div>
              {err.message}
            </div>
          </div>
          {notPublished && (
            <p className="muted" style={{ fontSize: 12.5 }}>
              The endpoint exists but is serving no compiled code. Publish the build to the
              live snapshot, not just the draft.
            </p>
          )}
          <button className="btn" onClick={onRetry}>Try again</button>
        </div>
      </div>
    </div>
  )
}
