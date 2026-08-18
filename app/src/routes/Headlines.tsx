import { useCallback, useEffect, useState } from 'react'
import { getHeadlines, saveHeadline, markHeadlineRead } from '../api'
import type { Headline } from '../api'
import { useApp } from '../state'
import { Avatar, Empty, ErrorBanner, Loading, Modal, RowMenu, fmtDate, firstLast } from '../lib/ui'
import { DropToIssueModal } from '../components/DropToIssue'

/*
 * One or two sentences. Good news and personnel news — the things a team should
 * hear but not discuss. If it needs discussing it becomes an Issue.
 *
 * Roll-forward is free: the L10 reads unread headlines, so anything not ticked
 * simply shows up again next week. No extra state and no scheduled job.
 */
export default function Headlines() {
  const { company } = useApp()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [rows, setRows] = useState<Headline[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [dropFor, setDropFor] = useState<Headline | null>(null)

  const load = useCallback(() => {
    setErr(null)
    getHeadlines(company.id, unreadOnly).then(r => setRows(r.rows)).catch(e => setErr(e.message))
  }, [company.id, unreadOnly])

  useEffect(() => { setRows(null); load() }, [load])

  const mark = async (h: Headline) => {
    try { await markHeadlineRead([h.id], !!h.readDate); load() } catch (e: any) { setErr(e.message) }
  }

  const unread = rows ? rows.filter(r => !r.readDate) : []

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1>Headlines</h1>
          <div className="page__sub">
            Customer and employee news, one or two sentences. Unread ones roll into the next L10.
          </div>
        </div>
        <div className="page__actions">
          <button className="btn" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(u => !u)}>
            {unreadOnly ? 'Show all' : `Unread only${unread.length ? ` (${unread.length})` : ''}`}
          </button>
          <button className="btn btn--primary" onClick={() => setAdding(true)}>+ Headline</button>
        </div>
      </div>

      <ErrorBanner error={err} onDismiss={() => setErr(null)} />

      {!rows ? (
        <Loading what="Loading headlines" />
      ) : rows.length === 0 ? (
        <div className="card">
          <Empty title="No headlines">
            Wins, losses, feedback, someone's good news. Anything the team should hear but doesn't
            need to debate.
          </Empty>
        </div>
      ) : (
        <div className="card card__body--flush">
          <div className="rows">
            {rows.map(h => (
              <div className={'rowitem' + (h.readDate ? ' rowitem--done' : '')} key={h.id}>
                <button
                  className={'check' + (h.readDate ? ' check--on' : '')}
                  onClick={() => mark(h)}
                  aria-label={h.readDate ? 'Mark unread' : 'Mark read'}
                  title={h.readDate ? `Read ${fmtDate(h.readDate)} — click to unmark` : 'Mark as read'}
                >
                  ✓
                </button>
                <Avatar name={h.createdByName} id={h.createdByName} sm />
                <div className="rowitem__main">
                  <div className="rowitem__title">
                    {h.body}
                    <span className={'pill ' + (h.type === 'customer' ? 'pill--green' : 'pill--muted')}>
                      <span className="pill__glyph" aria-hidden="true">{h.type === 'customer' ? '★' : '◆'}</span>
                      {h.type}
                    </span>
                  </div>
                  <div className="rowitem__meta">
                    <span>{firstLast({ name: h.createdByName })}</span>
                    {h.createdAt && <span>{fmtDate(h.createdAt.slice(0, 10))}</span>}
                    {!h.readDate && <span className="duesoon">unread — rolls forward</span>}
                  </div>
                </div>
                <div className="rowitem__end">
                  <RowMenu>
                    {close => (
                      <>
                        <button onClick={() => { close(); setDropFor(h) }}>Drop to Issues</button>
                        <button onClick={() => { close(); mark(h) }}>
                          Mark {h.readDate ? 'unread' : 'read'}
                        </button>
                      </>
                    )}
                  </RowMenu>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {adding && (
        <Modal title="New headline" onClose={() => setAdding(false)}>
          <HeadlineForm companyId={company.id} onDone={() => { setAdding(false); load() }} onCancel={() => setAdding(false)} />
        </Modal>
      )}

      {dropFor && (
        <DropToIssueModal
          origin={{ kind: 'headline', id: dropFor.id, label: dropFor.body }}
          suggestedTitle={dropFor.body}
          onClose={() => setDropFor(null)}
        />
      )}
    </div>
  )
}

export function HeadlineForm({
  companyId, onDone, onCancel,
}: { companyId: string; onDone: () => void; onCancel?: () => void }) {
  const [body, setBody] = useState('')
  const [type, setType] = useState<'customer' | 'employee'>('customer')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!body.trim()) { setErr('A headline needs some words.'); return }
    setBusy(true); setErr(null)
    try { await saveHeadline({ companyId, body: body.trim(), type }); setBody(''); onDone() }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false) }
  }

  return (
    <>
      <ErrorBanner error={err} onDismiss={() => setErr(null)} />
      <div className="field">
        <label htmlFor="h-body">Headline</label>
        <textarea
          id="h-body" className="textarea" autoFocus value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Two families completed the parent workshop and asked to co-lead the next one."
        />
        <div className="field__hint">One or two sentences. If it needs discussion, make it an Issue.</div>
      </div>
      <div className="field">
        <label htmlFor="h-type">Kind</label>
        <select id="h-type" className="select" value={type} onChange={e => setType(e.target.value as any)}>
          <option value="customer">Customer — a win, a loss, feedback</option>
          <option value="employee">Employee — personnel or personal news</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {onCancel && <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>}
        <button className="btn btn--primary" onClick={submit} disabled={busy || !body.trim()}>
          {busy ? 'Adding…' : 'Add headline'}
        </button>
      </div>
    </>
  )
}
