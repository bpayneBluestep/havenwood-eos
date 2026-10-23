import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from './state'
import { Avatar, firstLast } from './lib/ui'
import { logout } from './api'
import My90 from './routes/My90'
import Scorecard from './routes/Scorecard'
import Rocks from './routes/Rocks'
import Issues from './routes/Issues'
import Todos from './routes/Todos'
import Headlines from './routes/Headlines'
import L10 from './routes/L10'
import Meetings from './routes/Meetings'
import Meeting from './routes/Meeting'
import Admin from './routes/Admin'
import NotFound from './routes/NotFound'

/*
 * Left nav listing the tools in EOS order — not a hamburger, not tabs. These
 * teams have used Ninety for years, and the shape is the part they already know.
 */
const NAV: { to: string; label: string; icon: string; end?: boolean }[] = [
  { to: '/', label: 'My 90', icon: '◆', end: true },
  { to: '/scorecard', label: 'Scorecard', icon: '▦' },
  { to: '/rocks', label: 'Rocks', icon: '◈' },
  { to: '/issues', label: 'Issues', icon: '◉' },
  { to: '/todos', label: 'To-Dos', icon: '✓' },
  { to: '/headlines', label: 'Headlines', icon: '❝' },
]

const MEETING: { to: string; label: string; icon: string; end?: boolean }[] = [
  { to: '/l10', label: 'Level 10', icon: '▶' },
  { to: '/meetings', label: 'Meetings', icon: '◎' },
]

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}

function Shell() {
  const { me, company, companies, multiCompany, setCompanyId, reload } = useApp()
  const loc = useLocation()

  const title =
    [...NAV, ...MEETING].find(n => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)))?.label ||
    (loc.pathname.startsWith('/admin') ? 'Admin' : 'Traction')

  // Company teams first, then the teams admins made on top of them.
  const companyTeams = companies.filter(c => (c.kind || 'company') === 'company')
  const customTeams = companies.filter(c => c.kind === 'custom')
  const label = (c: typeof company) => (c.kind === 'custom' ? c.name : c.settings.displayName || c.name)

  return (
    <div className="shell">
      <nav className="nav" aria-label="Tools">
        <div className="nav__brand">
          <span className="nav__mark" aria-hidden="true">HW</span>
          <span>
            <div className="nav__name">Traction</div>
            <div className="nav__sub">Hope Group EOS</div>
          </span>
        </div>

        <div className="nav__list">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              <span className="nav__ico" aria-hidden="true">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}

          <div className="nav__section">Meeting</div>
          {MEETING.map(n => (
            <NavLink key={n.to} to={n.to}>
              <span className="nav__ico" aria-hidden="true">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}

          {/* Admin (teams, people, settings, audit) is for the three hard-coded
              EOS admins only (ticket #269). The endpoint refuses everyone else;
              hiding it here just keeps it out of their way. */}
          {me.isAdmin && (
            <>
              <div className="nav__section">Admin</div>
              <NavLink to="/admin">
                <span className="nav__ico" aria-hidden="true">⚙</span>
                Teams &amp; settings
              </NavLink>
            </>
          )}
        </div>

        <div className="nav__foot">
          {label(company)}
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <span className="topbar__title">{title}</span>

          {/* Built so the single-team case renders NOTHING — not a disabled
              dropdown with one option. Most people are on exactly one team and
              should never learn the concept exists. */}
          {multiCompany && (
            <>
              <select
                className="select"
                style={{ width: 'auto', maxWidth: 240 }}
                value={company.id}
                onChange={e => setCompanyId(e.target.value)}
                aria-label="Team"
              >
                {customTeams.length === 0 ? companyTeams.map(c => (
                  <option key={c.id} value={c.id}>{label(c)}{c.settings.eosActive ? '' : ' (inactive)'}</option>
                )) : (
                  <>
                    {companyTeams.length > 0 && (
                      <optgroup label="Company teams">
                        {companyTeams.map(c => (
                          <option key={c.id} value={c.id}>{label(c)}{c.settings.eosActive ? '' : ' (inactive)'}</option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Teams">
                      {customTeams.map(c => (
                        <option key={c.id} value={c.id}>{label(c)}{c.settings.eosActive ? '' : ' (inactive)'}</option>
                      ))}
                    </optgroup>
                  </>
                )}
              </select>
              <span className="topbar__meta nowrap">{company.periods.week} · {company.periods.quarter}</span>
            </>
          )}
          {!multiCompany && (
            <span className="topbar__meta nowrap">{company.periods.week} · {company.periods.quarter}</span>
          )}

          <div className="topbar__end">
            {me.isSuper && (
              <button className="btn" onClick={openTemporaryLogin} title="Sign in as another user to test what they see">
                Log in as…
              </button>
            )}
            <span className="topbar__meta nowrap" title={me.email}>{firstLast({ name: me.name })}</span>
            <Avatar name={me.name} id={me.id || me.userId} />
            <button className="btn" onClick={signOut}>Sign out</button>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<My90 />} />
          <Route path="/scorecard" element={<Scorecard />} />
          <Route path="/rocks" element={<Rocks />} />
          <Route path="/issues" element={<Issues />} />
          <Route path="/todos" element={<Todos />} />
          <Route path="/headlines" element={<Headlines />} />
          <Route path="/l10" element={<L10 />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/meetings/:id" element={<Meeting />} />
          {me.isAdmin && <Route path="/admin" element={<Admin onChanged={reload} />} />}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </div>
  )
}

/*
 * Super-only: BlueStep's Temporary Login (ported from ec-crm's Tools menu). It
 * switches this browser's session to another user. Traction isn't mounted in a
 * BlueStep page, so there's no doPopup global — open it ourselves, and reload
 * when it closes so the app re-reads who the session now belongs to.
 */
function openTemporaryLogin() {
  const w = window.open('/shared/login/templogin.jsp', 'traction-templogin', 'width=550,height=400,resizable=yes,scrollbars=yes')
  if (!w) { alert('Allow pop-ups for this site to use Temporary Login.'); return }
  const t = window.setInterval(() => {
    if (w.closed) { window.clearInterval(t); window.location.reload() }
  }, 500)
}

// Ends the BlueStep session and reloads into Traction's own sign-in form. After
// a Temporary Login, this is how you get back to your own account.
async function signOut() {
  await logout()
  window.location.reload()
}
