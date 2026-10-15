import { useState } from 'react'
import type { FormEvent } from 'react'
import { login, logout, nativeLoginSubmit } from './api'
import type { Bootstrap } from './api'

/*
 * Traction's own sign-in screen, so nobody is sent to the old BlueStep login
 * page. Signs in with the same BlueStep account, in place (see login() in
 * api.ts). Global users who need an email code are handed to the platform's
 * code page, which returns them here afterwards.
 */
export function Login({ onSignedIn, onNoAccess }: { onSignedIn: (d: Bootstrap) => void; onNoAccess: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const u = username.trim()
    if (!u || !password) return
    setBusy(true); setErr(null)
    const res = await login(u, password)
    if (res.ok) { onSignedIn(res.data); return }
    if (res.twoFactor) { nativeLoginSubmit(u, password, location.pathname + location.search + location.hash); return }
    if (res.noAccess) { onNoAccess(); return }
    setBusy(false)
    setPassword('')
    setErr(res.error || 'Sign in failed.')
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit} autoComplete="on">
        <div className="auth-mark" aria-hidden="true">HW</div>
        <h1 className="auth-title">Sign in to Traction</h1>
        <p className="auth-sub">Use your BlueStep account.</p>

        <div className="field">
          <label htmlFor="lg-user">Username</label>
          <input id="lg-user" className="input" autoFocus autoComplete="username" autoCapitalize="none"
            autoCorrect="off" spellCheck={false} value={username} onChange={e => setUsername(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="lg-pass">Password</label>
          <input id="lg-pass" className="input" type="password" autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)} required />
        </div>

        {err && <p className="auth-error" role="alert">{err}</p>}

        <button type="submit" className="btn btn--primary auth-btn" disabled={busy || !username.trim() || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="auth-or"><span>or</span></div>
        <div className="auth-sso">
          <button type="button" className="btn auth-btn" onClick={() => goSSO('microsoft')}>Sign in with Microsoft</button>
          <button type="button" className="btn auth-btn" onClick={() => goSSO('google')}>Sign in with Google</button>
        </div>
      </form>
    </div>
  )
}

/* Signed in, but not on any EOS team. Offer to sign out and try another account. */
export function NoAccess({ message, onSignedOut }: { message: string; onSignedOut: () => void }) {
  const [busy, setBusy] = useState(false)
  const out = async () => { setBusy(true); await logout(); onSignedOut() }
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-mark" aria-hidden="true">HW</div>
        <h1 className="auth-title">No access to Traction yet</h1>
        <p className="auth-sub">{message || 'Ask an administrator to add you to a team on your EOS Teams form.'}</p>
        <button className="btn auth-btn" onClick={out} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button>
      </div>
    </div>
  )
}

/*
 * Microsoft / Google sign-in, ported from ec-crm's goSSO(). The provider
 * round-trip has to be a full-page navigation: BlueStep's OAuth starter sends
 * the user to the provider, then back to this exact Traction URL, signed in.
 */
function goSSO(provider: 'microsoft' | 'google') {
  const oauth2Host = location.hostname.endsWith('.myassn.com') ? 'oauth2.myassn.com' : 'oauth2.bluestep.net'
  const dest = location.origin + location.pathname + location.search + location.hash
  location.href = 'https://' + oauth2Host + '/v1/login/initiate/' + provider
    + '?host=' + encodeURIComponent(location.host)
    + '&destUrl=' + encodeURIComponent(dest)
}
