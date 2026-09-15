import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from './state'
import { Avatar, firstLast } from './lib/ui'
import My90 from './routes/My90'
import Scorecard from './routes/Scorecard'
import Rocks from './routes/Rocks'
import Issues from './routes/Issues'
import Todos from './routes/Todos'
import Headlines from './routes/Headlines'
import L10 from './routes/L10'
import Settings from './routes/Settings'
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
]

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}

function Shell() {
  const { me, company, companies, multiCompany, setCompanyId } = useApp()
  const loc = useLocation()

  const title =
    [...NAV, ...MEETING].find(n => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)))?.label ||
    (loc.pathname.startsWith('/settings') ? 'Settings' : 'Traction')

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

          {/* Settings is open to the whole EOS group — the EOS checkbox is the
              only permission Traction has. No admin tier. */}
          <div className="nav__section">Admin</div>
          <NavLink to="/settings">
            <span className="nav__ico" aria-hidden="true">⚙</span>
            Settings
          </NavLink>
        </div>

        <div className="nav__foot">
          {company.settings.displayName || company.name}
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <span className="topbar__title">{title}</span>

          {/* Built so the single-company case renders NOTHING — not a disabled
              dropdown with one option. Almost every user resolves to exactly one
              company and should never learn the concept exists. */}
          {multiCompany && (
            <>
              <select
                className="select"
                style={{ width: 'auto', maxWidth: 240 }}
                value={company.id}
                onChange={e => setCompanyId(e.target.value)}
                aria-label="Company"
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.settings.displayName || c.name}{c.settings.eosActive ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
              <span className="topbar__meta nowrap">{company.periods.week} · {company.periods.quarter}</span>
            </>
          )}
          {!multiCompany && (
            <span className="topbar__meta nowrap">{company.periods.week} · {company.periods.quarter}</span>
          )}

          <div className="topbar__end">
            <span className="topbar__meta nowrap" title={me.email}>{firstLast({ name: me.name })}</span>
            <Avatar name={me.name} id={me.id || me.userId} />
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
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </div>
  )
}
