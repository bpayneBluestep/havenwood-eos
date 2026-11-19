/**
 * Recurring schedules for todos, issues and headlines.
 * Stored on each eosTodos / eosIssues / eosHeadlines dataJSON row.
 * Keep identical to scripts/itemRecurrence.ts on the Traction Maestro endpoint.
 */

export type RecurrenceFreq = 'weekly' | 'biweekly' | 'monthly' | 'custom'

export interface ItemRecurrence {
  freq: RecurrenceFreq
  /** Every N weeks (weekly/biweekly/custom) or months (monthly). Minimum 1. */
  interval: number
  /** 0=Sun … 6=Sat. Required for custom; optional pin for weekly/biweekly. */
  weekdays: number[]
  /** Anchor / first due date (YYYY-MM-DD). */
  start: string
  /** Inclusive end date, or null for no end. */
  until: string | null
  /** Shared across instances of one series. */
  seriesId: string
}

export type RecurrencePreset = 'off' | 'weekly' | 'biweekly' | 'monthly' | 'custom'

const ISO = /^\d{4}-\d{2}-\d{2}$/

function isDate(value: string): boolean {
  if (!ISO.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const days = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= days[m - 1]
}

function parseDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(value: string, days: number): string {
  const date = parseDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return formatDate(date)
}

function addMonths(value: string, months: number): string {
  const date = parseDate(value)
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + months)
  const max = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, max))
  return formatDate(date)
}

function weekdayOf(value: string): number {
  return parseDate(value).getUTCDay()
}

function newSeriesId(): string {
  return 'series_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function defaultRecurrence(start: string, preset: Exclude<RecurrencePreset, 'off'> = 'weekly'): ItemRecurrence {
  const day = isDate(start) ? weekdayOf(start) : 1
  if (preset === 'monthly') {
    return { freq: 'monthly', interval: 1, weekdays: [], start, until: null, seriesId: newSeriesId() }
  }
  if (preset === 'biweekly') {
    return { freq: 'biweekly', interval: 2, weekdays: [day], start, until: null, seriesId: newSeriesId() }
  }
  if (preset === 'custom') {
    return { freq: 'custom', interval: 1, weekdays: [day], start, until: null, seriesId: newSeriesId() }
  }
  return { freq: 'weekly', interval: 1, weekdays: [day], start, until: null, seriesId: newSeriesId() }
}

export function normalizeRecurrence(input: unknown, fallbackStart: string): ItemRecurrence | null {
  if (input == null || input === false) return null
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid recurrence.')
  const raw = input as Record<string, unknown>
  if (raw.enabled === false || raw.freq === 'none' || raw.freq === 'off') return null

  const freq = raw.freq
  if (freq !== 'weekly' && freq !== 'biweekly' && freq !== 'monthly' && freq !== 'custom') {
    throw new Error('Choose a recurrence cadence.')
  }

  const start = typeof raw.start === 'string' && raw.start ? raw.start : fallbackStart
  if (!isDate(start)) throw new Error('Recurrence needs a valid start date.')

  let interval = raw.interval === undefined || raw.interval === null || raw.interval === '' ? (freq === 'biweekly' ? 2 : 1) : Number(raw.interval)
  if (!Number.isInteger(interval) || interval < 1 || interval > 52) throw new Error('Recurrence interval must be 1–52.')
  if (freq === 'biweekly') interval = Math.max(2, interval)

  let weekdays: number[] = []
  if (Array.isArray(raw.weekdays)) {
    weekdays = raw.weekdays.map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
    weekdays = [...new Set(weekdays)].sort((a, b) => a - b)
  }
  if (freq === 'custom') {
    if (!weekdays.length) throw new Error('Pick at least one weekday for a custom cadence.')
  } else if (freq === 'weekly' || freq === 'biweekly') {
    if (!weekdays.length) weekdays = [weekdayOf(start)]
  } else {
    weekdays = []
  }

  const untilRaw = raw.until
  const until = untilRaw == null || untilRaw === '' ? null : String(untilRaw)
  if (until && !isDate(until)) throw new Error('Recurrence end date is invalid.')
  if (until && until < start) throw new Error('Recurrence cannot end before it starts.')

  const seriesId = typeof raw.seriesId === 'string' && raw.seriesId.trim() ? raw.seriesId.trim().slice(0, 80) : newSeriesId()
  return { freq, interval, weekdays, start, until, seriesId }
}

export function recurrenceLabel(recurrence: ItemRecurrence | null | undefined): string {
  if (!recurrence) return ''
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  if (recurrence.freq === 'monthly') {
    return recurrence.interval === 1 ? 'Monthly' : `Every ${recurrence.interval} months`
  }
  if (recurrence.freq === 'custom') {
    const names = recurrence.weekdays.map(day => days[day]).join(', ')
    return recurrence.interval === 1 ? `Weekly on ${names}` : `Every ${recurrence.interval} weeks on ${names}`
  }
  if (recurrence.freq === 'biweekly') {
    const day = recurrence.weekdays[0]
    return day == null ? 'Every 2 weeks' : `Every 2 weeks on ${days[day]}`
  }
  const day = recurrence.weekdays[0]
  return day == null ? 'Weekly' : `Weekly on ${days[day]}`
}

/** Next due date strictly after `after` for this cadence, or null if past until. */
export function nextOccurrence(after: string, recurrence: ItemRecurrence): string | null {
  if (!isDate(after)) return null
  const cursor = after

  if (recurrence.freq === 'monthly') {
    let next = addMonths(recurrence.start, 0)
    // Walk forward from start in interval steps until > after.
    let guard = 0
    while (next <= after && guard < 600) {
      const months = recurrence.interval * (++guard)
      next = addMonths(recurrence.start, months)
    }
    if (recurrence.until && next > recurrence.until) return null
    return next > after ? next : null
  }

  const weekdays = recurrence.weekdays.length ? recurrence.weekdays : [weekdayOf(recurrence.start)]
  const intervalWeeks = recurrence.freq === 'biweekly' ? Math.max(2, recurrence.interval) : Math.max(1, recurrence.interval)
  const startWeekday = weekdayOf(recurrence.start)
  const startWeekMonday = addDays(recurrence.start, -((startWeekday + 6) % 7)) // Monday of start week

  let day = addDays(cursor, 1)
  for (let i = 0; i < 800; i++, day = addDays(day, 1)) {
    if (recurrence.until && day > recurrence.until) return null
    const wd = weekdayOf(day)
    if (weekdays.indexOf(wd) < 0) continue
    if (recurrence.freq === 'weekly' && intervalWeeks === 1) return day

    const monday = addDays(day, -((wd + 6) % 7))
    const diffDays = Math.round((parseDate(monday).getTime() - parseDate(startWeekMonday).getTime()) / 86400000)
    const weeks = Math.floor(diffDays / 7)
    if (weeks < 0) continue
    if (weeks % intervalWeeks === 0) return day
  }
  return null
}

export interface RecurringCompletionPlan {
  archiveCurrent: true
  completeStatus: 'done' | 'solved' | 'read'
  nextDueDate: string | null
  recurrence: ItemRecurrence
}

/** When a recurring todo/issue/headline is completed: archive it and spawn the next open instance. */
export function planRecurringCompletion(
  kind: 'todo' | 'issue' | 'headline',
  recurrence: ItemRecurrence | null | undefined,
  currentDueOrDate: string | null | undefined,
  today: string,
): RecurringCompletionPlan | null {
  if (!recurrence) return null
  const anchor = currentDueOrDate && isDate(currentDueOrDate) ? currentDueOrDate : (isDate(today) ? today : recurrence.start)
  const nextDueDate = nextOccurrence(anchor, recurrence)
  return {
    archiveCurrent: true,
    completeStatus: kind === 'todo' ? 'done' : kind === 'issue' ? 'solved' : 'read',
    nextDueDate,
    recurrence,
  }
}
