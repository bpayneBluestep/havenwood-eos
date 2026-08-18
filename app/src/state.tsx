import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { bootstrap, ApiError } from './api'
import type { Bootstrap, CompanyBrief, Me, Person } from './api'

/*
 * One bootstrap call carries the whole app shell: who I am, which companies I
 * resolve to, and my leadership team (the derived roster from Security - EOS,
 * used only to populate owner pickers — never to gate anything).
 *
 * The selected company lives here because almost every user resolves to exactly
 * one and should never learn the concept exists.
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
    return (
      <div className="page">
        <div className="banner banner--warn">
          <div>
            <div className="banner__b">No company is set up for your unit yet.</div>
            Traction stores each company's data on its Facility record. Yours has not been
            configured — ask an administrator to enable EOS for your unit.
          </div>
        </div>
      </div>
    )
  }

  const nameOf = (id: string) => {
    if (!id) return ''
    const hit = data.team.find(p => p.id === id)
    if (hit) return hit.name
    return data.me.id === id ? data.me.name : ''
  }

  const value: Ctx = {
    me: data.me,
    companies: data.companies,
    company,
    team: data.team,
    multiCompany: data.multiCompany,
    setCompanyId,
    reload,
    nameOf,
  }

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

/*
 * The two non-JSON failures need opposite fixes and both arrive as HTML, so they
 * get different screens rather than one generic error.
 */
function GateError({ err, onRetry }: { err: ApiError; onRetry: () => void }) {
  if (err.needsLogin) {
    return (
      <div className="page">
        <div className="card" style={{ maxWidth: 460, margin: '10vh auto' }}>
          <div className="card__head"><h2>Sign in required</h2></div>
          <div className="card__body">
            <p style={{ marginTop: 0 }}>
              Traction uses your BlueStep session. Sign in, then come back to this page.
            </p>
            <a className="btn btn--primary" href="/shared/login/login.jsp">Go to the BlueStep login</a>
          </div>
        </div>
      </div>
    )
  }

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
