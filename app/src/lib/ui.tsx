import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { CellStatus, Goal, Person } from '../api'
import { searchStaff } from '../api'

/* ------------------------------------------------------------------ format */

/** fullName() is "Last, First". Show people the way they'd say their own name. */
export function firstLast(p?: { name?: string; displayName?: string } | null): string {
  if (!p) return ''
  if (p.displayName) return p.displayName
  const n = p.name || ''
  const i = n.indexOf(',')
  return i > 0 ? (n.slice(i + 1).trim() + ' ' + n.slice(0, i).trim()).trim() : n
}

export function initials(name: string): string {
  const s = firstLast({ name })
  const parts = s.split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2)
  return (parts[0][0] + parts[parts.length - 1][0])
}

/** Stable colour per person, so the same face is the same colour everywhere. */
const AV_COLORS = ['#2f6fb5', '#7a4fb5', '#b5504f', '#2f8f6f', '#a86a1f', '#4f6fa8', '#8f4f7a', '#3f7a8f']
export function avatarColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AV_COLORS[h % AV_COLORS.length]
}

export function fmtValue(v: number | null | undefined, valueType = 'number'): string {
  if (v === null || v === undefined) return ''
  if (valueType === 'currency') return '$' + Math.round(v).toLocaleString()
  if (valueType === 'percent') return v + '%'
  if (valueType === 'yesno') return v ? 'Yes' : 'No'
  return String(Math.round(v * 100) / 100)
}

const OPS: Record<string, string> = { gte: '≥', gt: '>', lte: '≤', lt: '<', eq: '=', between: '', none: '' }

export function fmtGoal(goal?: Goal | null, valueType = 'number'): string {
  if (!goal || goal.op === 'none' || goal.target === null) return 'no goal'
  if (goal.op === 'between') return `${fmtValue(goal.target, valueType)}–${fmtValue(goal.target2, valueType)}`
  return `${OPS[goal.op] || goal.op} ${fmtValue(goal.target, valueType)}`
}

/** 'Aug 25' / 'Aug 25, 2027' — parsed as local, never UTC-shifted. */
export function fmtDate(iso?: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const now = new Date()
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === now.getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }
  return d.toLocaleDateString(undefined, opts)
}

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function plusDaysIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Class for a due date: overdue reads red, due within 2 days amber. */
export function dueClass(iso?: string | null, done = false): string {
  if (!iso || done) return ''
  const t = todayIso()
  if (iso < t) return 'overdue'
  const soon = plusDaysIso(2)
  return iso <= soon ? 'duesoon' : ''
}

/** Period keys are server-computed; we only ever shorten them for a column head. */
export function shortPeriod(key: string): string {
  const w = /^(\d{4})-W(\d{1,2})$/.exec(key)
  if (w) return 'W' + w[2]
  const mo = /^(\d{4})-(\d{2})$/.exec(key)
  if (mo) return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(mo[2]) - 1]
  const q = /^(\d{4})-Q([1-4])$/.exec(key)
  if (q) return 'Q' + q[2]
  return key
}

/* -------------------------------------------------------------- components */

export function Avatar({ name, id, sm }: { name?: string; id?: string; sm?: boolean }) {
  const label = firstLast({ name })
  if (!label) {
    return (
      <span className={'avatar avatar--none' + (sm ? ' avatar--sm' : '')} title="No owner" aria-label="No owner">
        –
      </span>
    )
  }
  return (
    <span
      className={'avatar' + (sm ? ' avatar--sm' : '')}
      style={{ background: avatarColor(id || label) }}
      title={label}
      aria-label={label}
    >
      {initials(name || '')}
    </span>
  )
}

export function Owner({ name, id, hideName }: { name?: string; id?: string; hideName?: boolean }) {
  return (
    <span className="owner">
      <Avatar name={name} id={id} sm />
      {!hideName && <span className="owner__name">{firstLast({ name }) || 'Unassigned'}</span>}
    </span>
  )
}

/*
 * Status never relies on colour alone: each pill carries a glyph, and the
 * scorecard cells carry both a glyph and a font weight.
 */
export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; glyph: string; label: string }> = {
    on_track: { cls: 'pill--green', glyph: '●', label: 'On Track' },
    off_track: { cls: 'pill--red', glyph: '▲', label: 'Off Track' },
    done: { cls: 'pill--muted', glyph: '✓', label: 'Done' },
    open: { cls: 'pill--amber', glyph: '○', label: 'Open' },
    solved: { cls: 'pill--green', glyph: '✓', label: 'Solved' },
  }
  const m = map[status] || { cls: 'pill--muted', glyph: '·', label: status }
  return (
    <span className={'pill ' + m.cls}>
      <span className="pill__glyph" aria-hidden="true">{m.glyph}</span>
      {m.label}
    </span>
  )
}

export function cellClass(status: CellStatus): string {
  if (status === 'green') return 'cell cell--green'
  if (status === 'red') return 'cell cell--red'
  return 'cell'
}

/** The glyph that keeps red/green legible without colour. */
export function cellMark(status: CellStatus): string {
  if (status === 'green') return '✓'
  if (status === 'red') return '▲'
  return ''
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__t">{title}</div>
      {children && <div className="empty__d">{children}</div>}
    </div>
  )
}

export function Loading({ what = 'Loading' }: { what?: string }) {
  return (
    <div className="loading">
      <span className="spinner" aria-hidden="true" />
      <span>{what}…</span>
    </div>
  )
}

export function ErrorBanner({ error, onDismiss }: { error: string | null; onDismiss?: () => void }) {
  if (!error) return null
  return (
    <div className="banner banner--error">
      <div style={{ flex: 1 }}>{error}</div>
      {onDismiss && <button className="btn btn--sm btn--ghost" onClick={onDismiss}>Dismiss</button>}
    </div>
  )
}

export function Modal({
  title, onClose, children, footer, wide,
}: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={'modal' + (wide ? ' modal--wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__head">
          <h2>{title}</h2>
          <button className="btn btn--sm btn--ghost" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  )
}

/*
 * Ninety leans on right-click hard. An overflow button is the accessible
 * equivalent, and it is where "drop to Issue" lives on every row.
 */
export function RowMenu({ children }: { children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="menu" ref={ref}>
      <button className="menu__btn" onClick={() => setOpen(o => !o)} aria-label="Row actions" aria-expanded={open}>
        ⋯
      </button>
      {open && <div className="menu__pop">{children(() => setOpen(false))}</div>}
    </div>
  )
}

/*
 * Owner picker. Offers the leadership team first (the derived roster), and falls
 * back to a staff search for anyone outside it.
 */
export function OwnerPicker({
  team, value, valueName, onChange,
}: {
  team: Person[]
  value: string
  valueName?: string
  onChange: (id: string, name: string) => void
}) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Person[] | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (q.trim().length < 2) { setHits(null); return }
    let live = true
    setBusy(true)
    const t = setTimeout(() => {
      searchStaff(q.trim())
        .then(r => { if (live) setHits(r.rows) })
        .catch(() => { if (live) setHits([]) })
        .finally(() => { if (live) setBusy(false) })
    }, 250)
    return () => { live = false; clearTimeout(t) }
  }, [q])

  const inTeam = team.some(p => p.id === value)

  return (
    <div>
      <select
        className="select"
        value={inTeam ? value : ''}
        onChange={e => {
          const p = team.find(x => x.id === e.target.value)
          onChange(e.target.value, p ? p.name : '')
        }}
      >
        <option value="">— Unassigned —</option>
        {team.map(p => (
          <option key={p.id} value={p.id}>{firstLast(p)}</option>
        ))}
        {!inTeam && value && <option value={value}>{firstLast({ name: valueName }) || value}</option>}
      </select>

      <div style={{ marginTop: 6 }}>
        <input
          className="input"
          placeholder="…or search all staff by name"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        {busy && <div className="field__hint">Searching…</div>}
        {hits && hits.length === 0 && !busy && <div className="field__hint">No matches.</div>}
        {hits && hits.length > 0 && (
          <div className="menu__pop" style={{ position: 'static', marginTop: 5, maxHeight: 180, overflowY: 'auto' }}>
            {hits.map(p => (
              <button key={p.id} type="button" onClick={() => { onChange(p.id, p.name); setQ(''); setHits(null) }}>
                <Avatar name={p.name} id={p.id} sm />
                {firstLast(p)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
