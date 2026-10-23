import { useCallback, useEffect, useState } from 'react'
import { adminAudit, adminOverview, adminPeople, adminSaveTeam, adminSetMembership, adminTeam } from '../api'
import type { AdminMember, AdminPerson, AdminTeam, AuditRow } from '../api'
import { Avatar, Empty, ErrorBanner, Loading, Modal, firstLast } from '../lib/ui'
import SettingsForm from './Settings'

/*
 * The admin side of Traction (ticket #269). Only the three hard-coded EOS
 * admins see this page; the endpoint refuses every admin action for anyone
 * else, so hiding it here is presentation, not the security.
 *
 * Admins configure — teams, who is on them, settings. They do NOT see a team's
 * data from here, and they don't see it anywhere else either unless they add
 * themselves to the team. Every change lands in the audit log.
 */

type Tab = 'teams' | 'people' | 'settings' | 'audit'

interface Overview { teams: AdminTeam[]; companies: { id: string; name: string }[]; admins: { id: string; name: string }[]; reach: string }

export default function Admin({ onChanged }: { onChanged?: () => void }) {
  const [tab, setTab] = useState<Tab>('teams')
  const [ov, setOv] = useState<Overview | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    setErr(null)
    adminOverview().then(setOv).catch(e => setErr(e.message))
  }, [])
  useEffect(() => { load() }, [load])

  // Keep the overview current from each write's reply, then let the app shell
  // re-read bootstrap in case the admin changed their own teams.
  const changed = useCallback((t?: AdminTeam) => {
    if (t) setOv(o => (o ? { ...o, teams: o.teams.some(x => x.id === t.id) ? o.teams.map(x => (x.id === t.id ? t : x)) : [...o.teams, t] } : o))
    onChanged?.()
  }, [onChanged])

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1>Admin</h1>
          <div className="page__sub">
            Teams, who is on them, and settings. Being an admin doesn't show you a team's data — only being on the team does.
          </div>
        </div>
        <div className="page__actions">
          <div className="seg" role="group" aria-label="Admin section">
            {(['teams', 'people', 'settings', 'audit'] as Tab[]).map(t => (
              <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ErrorBanner error={err} onDismiss={() => setErr(null)} />

      {!ov ? <Loading what="Loading teams" /> : (
        <>
          {tab === 'teams' && <TeamsTab ov={ov} onChanged={changed} onError={setErr} />}
          {tab === 'people' && <PeopleTab ov={ov} onChanged={changed} onError={setErr} />}
          {tab === 'settings' && <SettingsTab ov={ov} onChanged={() => { load(); onChanged?.() }} />}
          {tab === 'audit' && <AuditTab ov={ov} onError={setErr} />}
        </>
      )}
    </div>
  )
}

function teamLabel(t: AdminTeam): string {
  return t.kind === 'company' ? t.name : `${t.name} · ${t.homeName}`
}

// ------------------------------------------------------------------- Teams

function TeamsTab({ ov, onChanged, onError }: { ov: Overview; onChanged: (t?: AdminTeam) => void; onError: (m: string) => void }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const rows = ov.teams.filter(t => showArchived || !t.archivedAt)
  const open = ov.teams.find(t => t.id === openId) || null

  return (
    <>
      <div className="card">
        <div className="card__head">
          <h2>Teams</h2>
          <span className="card__end" style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--sm" aria-pressed={showArchived} onClick={() => setShowArchived(a => !a)}>
              {showArchived ? 'Hide archived' : 'Show archived'}
            </button>
            <button className="btn btn--sm btn--primary" onClick={() => setCreating(true)}>+ New team</button>
          </span>
        </div>
        <div className="card__body--flush">
          <div className="rows">
            {rows.map(t => (
              <button
                key={t.id}
                className="rowitem"
                style={{ width: '100%', textAlign: 'left', background: t.id === openId ? 'var(--hover, rgba(0,0,0,.03))' : undefined }}
                onClick={() => setOpenId(id => (id === t.id ? null : t.id))}
                aria-expanded={t.id === openId}
              >
                <div className="rowitem__main">
                  <div className="rowitem__title">
                    {t.name}
                    <span className="pill pill--muted">{t.kind === 'company' ? 'company team' : 'team'}</span>
                    {t.archivedAt && <span className="pill pill--amber">archived</span>}
                    {!t.archivedAt && !t.eosActive && <span className="pill pill--amber">inactive</span>}
                  </div>
                  <div className="rowitem__meta">
                    {t.kind === 'custom' && <span>on {t.homeName}</span>}
                    <span>{t.memberCount} member{t.memberCount === 1 ? '' : 's'}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {open && <TeamEditor key={open.id} team={open} onChanged={onChanged} onError={onError} />}

      {creating && (
        <NewTeamModal
          companies={ov.companies}
          onClose={() => setCreating(false)}
          onCreated={t => { setCreating(false); onChanged(t); setOpenId(t.id) }}
        />
      )}
    </>
  )
}

function TeamEditor({ team, onChanged, onError }: { team: AdminTeam; onChanged: (t?: AdminTeam) => void; onError: (m: string) => void }) {
  const [members, setMembers] = useState<AdminMember[] | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    adminTeam(team.id).then(r => setMembers(r.members)).catch(e => onError(e.message))
  }, [team.id, onError])
  useEffect(() => { load() }, [load])

  const setMember = async (personId: string, member: boolean) => {
    setBusy(true)
    try {
      const r = await adminSetMembership(team.id, personId, member, team.rev)
      onChanged(r.team)
      load()
    } catch (e: any) {
      if (e.current) onChanged(e.current)
      onError(e.message)
    } finally { setBusy(false) }
  }

  const archive = async (archived: boolean) => {
    if (archived && !confirm(`Archive "${team.name}"? Its members lose it from their team list. Nothing is deleted, and you can restore it.`)) return
    setBusy(true)
    try {
      const r = await adminSaveTeam({ companyId: team.id, archived, rev: team.rev })
      onChanged(r.team)
    } catch (e: any) { onError(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="card">
      <div className="card__head">
        <h2>{team.name}</h2>
        <span className="pill pill--muted">{team.kind === 'company' ? 'company team' : `on ${team.homeName}`}</span>
        {team.kind === 'custom' && (
          <span className="card__end">
            <button className="btn btn--sm" onClick={() => archive(!team.archivedAt)} disabled={busy}>
              {team.archivedAt ? 'Restore team' : 'Archive team'}
            </button>
          </span>
        )}
      </div>
      <div className="card__body">
        {team.archivedAt ? (
          <div className="banner banner--warn"><div>This team is archived. Restore it to change who is on it.</div></div>
        ) : (
          <PersonSearch
            excludeIds={(members || []).map(m => m.id)}
            actionLabel="Add"
            disabled={busy}
            onPick={p => setMember(p.id, true)}
          />
        )}
      </div>
      <div className="card__body--flush">
        {!members ? <Loading what="Loading members" /> : members.length === 0 ? (
          <Empty title="Nobody is on this team yet">
            Add people above. They see this team's scorecard, rocks, issues, to-dos and Level 10 from their next page load.
          </Empty>
        ) : (
          <div className="rows">
            {members.map(m => (
              <div className="rowitem" key={m.id}>
                <Avatar name={m.name} id={m.id} />
                <div className="rowitem__main">
                  <div className="rowitem__title">
                    {firstLast(m)}
                    {m.former && <span className="pill pill--amber" title="No longer current staff, so they can't sign in to Traction">former staff</span>}
                  </div>
                  <div className="rowitem__meta">{m.email && <span>{m.email}</span>}</div>
                </div>
                {!team.archivedAt && (
                  <div className="rowitem__end">
                    <button
                      className="btn btn--sm btn--ghost btn--danger"
                      disabled={busy}
                      onClick={() => { if (confirm(`Remove ${firstLast(m)} from ${team.name}?`)) setMember(m.id, false) }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NewTeamModal({ companies, onClose, onCreated }: {
  companies: { id: string; name: string }[]
  onClose: () => void
  onCreated: (t: AdminTeam) => void
}) {
  const [name, setName] = useState('')
  const [homeId, setHomeId] = useState(companies[0]?.id || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true); setErr(null)
    try {
      const r = await adminSaveTeam({ displayName: name.trim(), homeCompanyId: homeId })
      onCreated(r.team)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal
      title="New team"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={submit} disabled={busy || !name.trim() || !homeId}>
            {busy ? 'Creating…' : 'Create team'}
          </button>
        </>
      }
    >
      <ErrorBanner error={err} onDismiss={() => setErr(null)} />
      <div className="field">
        <label htmlFor="nt-name">Team name</label>
        <input id="nt-name" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Clinical Directors" autoFocus />
      </div>
      <div className="field">
        <label htmlFor="nt-home">Belongs to</label>
        <select id="nt-home" className="select" value={homeId} onChange={e => setHomeId(e.target.value)}>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="field__hint">
          The company whose records hold this team's data. Members can come from any company. Rocks
          this team raises into the roll-up show on this company's team. This can't be changed later.
        </div>
      </div>
    </Modal>
  )
}

// ------------------------------------------------------------------ People

function PeopleTab({ ov, onChanged, onError }: { ov: Overview; onChanged: (t?: AdminTeam) => void; onError: (m: string) => void }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<AdminPerson[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const teams = ov.teams.filter(t => !t.archivedAt)

  useEffect(() => {
    const term = q.trim()
    if (term.length === 1) return
    const h = window.setTimeout(() => {
      adminPeople(term).then(r => setRows(r.rows)).catch(e => onError(e.message))
    }, 250)
    return () => window.clearTimeout(h)
  }, [q, onError])

  const toggle = async (p: AdminPerson, t: AdminTeam) => {
    const member = !p.teamIds.includes(t.id)
    setBusy(p.id + t.id)
    try {
      const r = await adminSetMembership(t.id, p.id, member, t.rev)
      onChanged(r.team)
      setRows(rs => (rs || []).map(x => (x.id !== p.id ? x : {
        ...x, teamIds: member ? [...x.teamIds, t.id] : x.teamIds.filter(id => id !== t.id),
      })))
    } catch (e: any) {
      if (e.current) onChanged(e.current)
      onError(e.message)
    } finally { setBusy(null) }
  }

  return (
    <div className="card">
      <div className="card__head">
        <h2>People</h2>
        <span className="card__end faint" style={{ fontSize: 12.5 }}>
          {q.trim().length >= 2 ? 'Search results' : 'Everyone on a team, plus the admins'}
        </span>
      </div>
      <div className="card__body">
        <input
          className="input"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search current staff by name or email"
          aria-label="Search staff"
        />
      </div>
      <div className="card__body--flush">
        {!rows ? <Loading what="Loading people" /> : rows.length === 0 ? (
          <Empty title={q.trim() ? 'No current staff match' : 'Nobody is on a team yet'} />
        ) : (
          <div className="rows">
            {rows.map(p => (
              <div className="rowitem" key={p.id} style={{ alignItems: 'flex-start' }}>
                <Avatar name={p.name} id={p.id} />
                <div className="rowitem__main">
                  <div className="rowitem__title">
                    {firstLast(p)}
                    {p.isAdmin && <span className="pill pill--muted">admin</span>}
                    {p.former && <span className="pill pill--amber">former staff</span>}
                  </div>
                  <div className="rowitem__meta">{p.email && <span>{p.email}</span>}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 6 }}>
                    {teams.map(t => (
                      <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                        <input
                          type="checkbox"
                          checked={p.teamIds.includes(t.id)}
                          disabled={busy !== null || (p.former && !p.teamIds.includes(t.id))}
                          onChange={() => toggle(p, t)}
                        />
                        {teamLabel(t)}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// A staff search box used to add someone to a team.
function PersonSearch({ excludeIds, actionLabel, disabled, onPick }: {
  excludeIds: string[]
  actionLabel: string
  disabled?: boolean
  onPick: (p: AdminPerson) => void
}) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<AdminPerson[]>([])

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setRows([]); return }
    const h = window.setTimeout(() => {
      adminPeople(term).then(r => setRows(r.rows.filter(p => !p.former))).catch(() => setRows([]))
    }, 250)
    return () => window.clearTimeout(h)
  }, [q])

  const shown = rows.filter(p => !excludeIds.includes(p.id))

  return (
    <div>
      <input
        className="input"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Add someone — search current staff"
        aria-label="Search staff to add"
      />
      {shown.length > 0 && (
        <div className="rows" style={{ marginTop: 6, border: '1px solid var(--border)', borderRadius: 6 }}>
          {shown.slice(0, 8).map(p => (
            <div className="rowitem" key={p.id}>
              <Avatar name={p.name} id={p.id} sm />
              <div className="rowitem__main">
                <div className="rowitem__title">{firstLast(p)}</div>
                <div className="rowitem__meta">{p.email && <span>{p.email}</span>}</div>
              </div>
              <div className="rowitem__end">
                <button className="btn btn--sm" disabled={disabled} onClick={() => { onPick(p); setQ('') }}>{actionLabel}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Settings

function SettingsTab({ ov, onChanged }: { ov: Overview; onChanged: () => void }) {
  const live = ov.teams.filter(t => !t.archivedAt)
  const [id, setId] = useState(live[0]?.id || '')
  const team = live.find(t => t.id === id) || live[0]

  if (!team) return <Empty title="No teams yet" />

  return (
    <>
      <div className="card">
        <div className="card__body">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="st-team">Team</label>
            <select id="st-team" className="select" value={team.id} onChange={e => setId(e.target.value)}>
              {live.map(t => <option key={t.id} value={t.id}>{teamLabel(t)}</option>)}
            </select>
          </div>
        </div>
      </div>
      <SettingsForm team={team} onSaved={onChanged} />
    </>
  )
}

// ------------------------------------------------------------------- Audit

const ACTIONS: Record<string, string> = {
  'team.create': 'created the team',
  'team.rename': 'renamed the team',
  'team.settings': 'changed settings',
  'team.archive': 'archived the team',
  'team.restore': 'restored the team',
  'member.add': 'added',
  'member.remove': 'removed',
}

function AuditTab({ ov, onError }: { ov: Overview; onError: (m: string) => void }) {
  const [teamId, setTeamId] = useState('')
  const [rows, setRows] = useState<AuditRow[] | null>(null)
  const [more, setMore] = useState(false)

  useEffect(() => {
    setRows(null)
    adminAudit({ teamId: teamId || undefined }).then(r => { setRows(r.rows); setMore(r.more) }).catch(e => onError(e.message))
  }, [teamId, onError])

  return (
    <div className="card">
      <div className="card__head">
        <h2>Audit log</h2>
        <span className="card__end">
          <select className="select" style={{ width: 'auto' }} value={teamId} onChange={e => setTeamId(e.target.value)} aria-label="Filter by team">
            <option value="">All teams</option>
            {ov.teams.map(t => <option key={t.id} value={t.id}>{teamLabel(t)}</option>)}
          </select>
        </span>
      </div>
      <div className="card__body--flush">
        {!rows ? <Loading what="Loading the audit log" /> : rows.length === 0 ? (
          <Empty title="Nothing logged yet">Every change made on this page is recorded here.</Empty>
        ) : (
          <div className="rows">
            {rows.map((r, i) => (
              <div className="rowitem" key={i}>
                <div className="rowitem__main">
                  <div className="rowitem__title" style={{ fontWeight: 500 }}>
                    {r.actorName || 'Someone'} {ACTIONS[r.action] || r.action}
                    {r.personId ? <> <strong>{r.personName || r.personId}</strong> {r.action === 'member.add' ? 'to' : 'from'}</> : null}
                    {' '}<strong>{r.teamName || r.teamId}</strong>
                    {r.action === 'team.rename' && r.detail?.from?.name && r.detail?.to?.name && (
                      <span className="faint"> ({r.detail.from.name} → {r.detail.to.name})</span>
                    )}
                  </div>
                  <div className="rowitem__meta"><span className="mono">{r.at.replace('T', ' ').slice(0, 16)}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
        {more && <div className="faint" style={{ padding: '8px 14px', fontSize: 12.5 }}>Showing the newest 200. Filter by team to see older changes.</div>}
      </div>
    </div>
  )
}
