import TeamSelector from './lib/TeamSelector'
import {useEffect, type MouseEvent} from 'react'
import {BHAG} from './lib/brand'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AppProvider, useApp } from './state'
import { Avatar,PersonName } from './lib/ui'
import { logout } from './api'
import My90 from './routes/My90'
import Scorecard from './routes/Scorecard'
import Rocks from './routes/Rocks'
import Issues from './routes/Issues'
import Todos from './routes/Todos'
import Headlines from './routes/Headlines'
import Meetings from './routes/Meetings'
import Meeting from './routes/Meeting'
import Admin from './routes/Admin'
import LiveMeetingLink from './components/LiveMeetingLink'
import MyNotifications from './routes/MyNotifications'
import MyProfile from './routes/MyProfile'
import Directory from './routes/Directory'
import Accountability from './routes/Accountability'
import Vision from './routes/Vision'
import WorkDetail from './routes/WorkDetail'
import NotFound from './routes/NotFound'
import TeamArchive from './routes/TeamArchive'

/*
 * Left nav listing the tools in EOS order — not a hamburger, not tabs. These
 * teams have used Ninety for years, and the shape is the part they already know.
 */
const NAV: { to: string; label: string; icon: string; end?: boolean }[] = [
  { to: '/', label: 'My Dashboard', icon: '◆', end: true },
  { to: '/scorecard', label: 'Scorecard', icon: '▦' },
  { to: '/rocks', label: 'Rocks', icon: '◈' },
  { to: '/issues', label: 'Issues', icon: '◉' },
  { to: '/todos', label: 'Action Items', icon: '✓' },
  { to: '/headlines', label: 'Headlines', icon: '❝' },
  { to: '/vision', label: 'Vision & Plan', icon: '◇' },
  { to: '/accountability', label: 'Accountability Chart', icon: '⊞' },
  { to: '/directory', label: 'Directory', icon: '◉' },
]

const MEETING: { to: string; label: string; icon: string; end?: boolean }[] = [
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
  const { me, company, companies, setCompanyId, reload, branding } = useApp()
  const loc = useLocation()
  const navigate = useNavigate()
  useEffect(()=>{const id=new URLSearchParams(loc.search).get('team');if(id&&companies.some(c=>c.id===id)&&id!==company.id)setCompanyId(id)},[loc.search,companies,company.id,setCompanyId])

  const title =
    [...NAV, ...MEETING].find(n => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)))?.label ||
    (loc.pathname.startsWith('/archive') ? 'Archive' : loc.pathname.startsWith('/my-profile') ? 'My Profile' : loc.pathname.startsWith('/my-notifications') ? 'My Notifications' : loc.pathname.startsWith('/admin') ? 'Admin' : 'TenK')

  // Same-route Meetings clicks otherwise leave the open conclusion/live view mounted.
  // Force a clean lobby entry so the nav always returns to the top-level Meetings page.
  const openMeetingsLobby = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!loc.pathname.startsWith('/meetings')) return
    event.preventDefault()
    navigate('/meetings', { replace: true, state: { meetingsLobby: Date.now() } })
  }

  return (
    <div className="shell">
      <nav className="nav" aria-label="Tools">
        <div className="nav__brand">
          <span className="nav__mark" aria-hidden="true">{branding?.logo?<img src={branding.logo} alt=""/>:'10K'}</span>
          <span>
            <div className="nav__name" title={BHAG} tabIndex={0}>TenK</div>
            <div className="nav__sub">from crisis to capability</div>
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
            <NavLink key={n.to} to={n.to} onClick={n.to === '/meetings' ? openMeetingsLobby : undefined}>
              <span className="nav__ico" aria-hidden="true">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}

          <LiveMeetingLink/>
          <div id="live-meeting-sidebar" />

          <NavLink to="/my-profile"><span className="nav__ico" aria-hidden="true">◉</span>My Profile</NavLink>
          <NavLink to="/my-notifications"><span className="nav__ico" aria-hidden="true">♧</span>My Notifications</NavLink>
          {/* Admin (teams, people, settings, audit) is for the three hard-coded
              EOS admins only (ticket #269). The endpoint refuses everyone else;
              hiding it here just keeps it out of their way. */}
          {(me.isAdmin || me.isTeamAdmin) && (
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
          {company.kind === 'custom' ? company.name : company.settings.displayName || company.name}
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <span className="topbar__title">{title}</span>

          {!loc.pathname.startsWith('/meetings') && <TeamSelector />}
          <span className="topbar__meta nowrap">{company.periods.week} · {company.periods.quarter}</span>

          <div className="topbar__end">
            {me.isSuper && (
              <button className="btn" onClick={openTemporaryLogin} title="Sign in as another user to test what they see">
                Log in as…
              </button>
            )}
            <span className="topbar__meta nowrap" title={me.email}><PersonName name={me.name} id={me.id}/></span>
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
          <Route path="/my-profile" element={<MyProfile/>} />
          <Route path="/work" element={<WorkDetail/>}/><Route path="/vision" element={<Vision/>}/><Route path="/accountability" element={<Accountability/>}/><Route path="/directory" element={<Directory/>} />
          <Route path="/my-notifications" element={<MyNotifications />} />
          <Route path="/headlines" element={<Headlines />} />
          <Route path="/l10" element={<Navigate to="/meetings" replace />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/archive" element={<TeamArchive />} />
          <Route path="/meetings/:id" element={<Meeting />} />
          {(me.isAdmin || me.isTeamAdmin) && <Route path="/admin" element={<Admin onChanged={reload} />} />}
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
