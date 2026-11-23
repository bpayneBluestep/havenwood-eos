import {useCallback, useEffect, useState} from 'react'
import {useApp} from '../state'
import {notifyTestRecent, notifyTestSend} from '../api'
import type {NotifyChannel, NotifySend} from '../api'
import {formatUsPhone, normalizeUsPhone, validateEmailSend, validateTextSend} from '../../../platform/notifications'

/*
 * Admin → Email and Text Testing. A system admin sends a test email or text to any address or
 * number, to prove TenK's delivery path end to end before real notification types are built on it.
 *
 * Email = a new System Notification History entry; text = a new Twilio Log entry. Each form's
 * post-save formula does the send; the endpoint returns the saved entry and its status. The
 * endpoint refuses both actions for non-admins, so hiding this tab is presentation, not security.
 */

const STATUS_LABEL: Record<NotifySend['status'], string> = {sent: 'Sent', failed: 'Failed', pending: 'Waiting'}

function when(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleString([], {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})
}

function shownTo(send: NotifySend): string {
  if (send.channel === 'email') return send.to
  const digits = normalizeUsPhone(send.to)
  return digits ? formatUsPhone(digits) : send.to
}

function Result({send}: {send: NotifySend}) {
  return <p className={`notify-result notify-result--${send.status}`} role="status">
    <strong>{STATUS_LABEL[send.status]}.</strong> {send.detail}
  </p>
}

function SendCard({channel, defaultTo, onSent}: {channel: NotifyChannel; defaultTo: string; onSent: (send: NotifySend) => void}) {
  const email = channel === 'email'
  const [to, setTo] = useState(defaultTo)
  const [subject, setSubject] = useState('TenK test email')
  const [message, setMessage] = useState(email ? 'This is a test email from TenK.' : 'This is a test text from TenK.')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [last, setLast] = useState<NotifySend | null>(null)
  const label = email ? 'Email' : 'Text'

  const send = async () => {
    setError(null)
    const checked = email ? validateEmailSend({to, subject, html: message}) : validateTextSend({to, message})
    if (!checked.ok) { setError(checked.error); return }
    setBusy(true)
    try {
      const result = await notifyTestSend({channel, to: to.trim(), subject: email ? subject.trim() : undefined, message: message.trim()})
      setLast(result)
      onSent(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The send failed.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="card card__body notify-card" role="group" aria-label={`Test ${label.toLowerCase()}`}>
    <h2>Test {label.toLowerCase()}</h2>
    <p className="muted">{email
      ? 'Saves a System Notification History entry. Its formula sends the email.'
      : 'Saves a Twilio Log entry. Its formula sends the text through Twilio. US numbers only.'}</p>
    <label>To
      <input className="input" type={email ? 'email' : 'tel'} value={to} placeholder={email ? 'name@example.com' : '(555) 555-0100'} onChange={e => setTo(e.target.value)} aria-label={`${label} to`}/>
    </label>
    {email && <label>Subject
      <input className="input" value={subject} onChange={e => setSubject(e.target.value)} aria-label="Email subject"/>
    </label>}
    <label>Message
      <textarea className="input" rows={email ? 5 : 3} value={message} onChange={e => setMessage(e.target.value)} aria-label={`${label} message`}/>
    </label>
    {!email && <p className="muted">Sent with "[TenK test]" in front so it can be told apart in the Twilio Log.</p>}
    <div className="notify-card__actions">
      <button className="btn btn--primary" disabled={busy} onClick={send}>{busy ? 'Sending…' : `Send test ${label.toLowerCase()}`}</button>
    </div>
    {error && <p className="notify-result notify-result--failed" role="alert">{error}</p>}
    {last && !error && <Result send={last}/>}
  </div>
}

export default function NotifyTesting() {
  const {me} = useApp()
  const [recent, setRecent] = useState<NotifySend[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    notifyTestRecent()
      .then(setRecent)
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load recent sends.'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const sent = useCallback((send: NotifySend) => {
    setRecent(rows => [send, ...(rows || []).filter(r => !(r.id === send.id && r.channel === send.channel))].slice(0, 10))
  }, [])

  return <section className="notify-testing" aria-label="Email and Text Testing">
    <div className="card card__body notify-notice">
      <strong>These send real messages.</strong>
      <p>Each send goes to the address or number you type, through the same email and text senders Hope Group already uses.</p>
    </div>
    <div className="notify-testing__cards">
      <SendCard channel="email" defaultTo={me.email || ''} onSent={sent}/>
      <SendCard channel="text" defaultTo="" onSent={sent}/>
    </div>
    <div className="card card__body">
      <div className="notify-recent__head">
        <h2>Recent test sends</h2>
        <button className="btn btn--sm" disabled={loading} onClick={refresh}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      {error && <p className="notify-result notify-result--failed" role="alert">{error}</p>}
      {recent && recent.length === 0 && <p className="muted">No test sends yet.</p>}
      {recent && recent.length > 0 && <table className="notify-recent">
        <thead><tr><th>When</th><th>Type</th><th>To</th><th>Status</th></tr></thead>
        <tbody>{recent.map(send => <tr key={send.channel + send.id}>
          <td>{when(send.at)}</td>
          <td>{send.channel === 'email' ? 'Email' : 'Text'}</td>
          <td>{shownTo(send)}</td>
          <td><span className={`notify-status notify-status--${send.status}`}>{STATUS_LABEL[send.status]}</span> <span className="muted">{send.detail}</span></td>
        </tr>)}</tbody>
      </table>}
    </div>
  </section>
}
