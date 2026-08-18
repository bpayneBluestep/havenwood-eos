/*
 * The single seam between this SPA and the platform. Everything that reads or
 * writes data goes through the Traction Maestro endpoint as one action envelope:
 *
 *   request  GET  /b/traction?action=<name>
 *            POST /b/traction   { action, ...fields }
 *   reply    { ok: true, data } | { ok: false, error, detail }
 *
 * Same-origin fetch, so the BlueStep session cookie rides along automatically.
 * No component fetches directly — if a screen needs data, it needs a function here.
 */

const MAESTRO_URL = '/b/traction'

export class ApiError extends Error {
  code: string
  status: number
  /** True when the failure means "you aren't signed in", not "the call broke". */
  needsLogin: boolean
  /** On STALE, the server's current copy of the entity so the UI can re-render. */
  current: any

  constructor(message: string, opts: { code?: string; status?: number; needsLogin?: boolean; current?: any } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = opts.code || 'REQUEST_FAILED'
    this.status = opts.status ?? 0
    this.needsLogin = !!opts.needsLogin
    this.current = opts.current ?? null
  }
}

async function handle(res: Response): Promise<any> {
  let json: any = null
  try {
    json = await res.json()
  } catch {
    // Non-JSON means we never reached the endpoint's own code. Distinguish the
    // two ways that happens, because they need OPPOSITE fixes:
    //   * the platform bounced us to the login page -> sign in
    //   * the endpoint itself failed before running -> it isn't compiled
    // A 5xx is NOT a login problem, even though it also arrives as HTML.
    const bouncedToLogin = res.status === 401 || (res.redirected && res.status < 400)
    if (bouncedToLogin) {
      throw new ApiError('Sign in to BlueStep to load this data.', {
        code: 'AUTH_REQUIRED', status: res.status, needsLogin: true,
      })
    }
    if (res.status >= 500) {
      throw new ApiError(
        `Traction returned HTTP ${res.status} with a non-JSON body. A bare "Error" here ` +
        `means the endpoint exists on the platform but no compiled code is published — the ` +
        `live snapshot needs scripts/app.js, not just a draft.`,
        { code: 'NOT_PUBLISHED', status: res.status },
      )
    }
    throw new ApiError(`Traction returned a non-JSON response (HTTP ${res.status}).`, {
      code: 'NON_JSON', status: res.status,
    })
  }

  if (!json || json.ok !== true) {
    const code = json?.error || 'REQUEST_FAILED'
    const detail = json?.detail || `Request failed (HTTP ${res.status}).`
    throw new ApiError(detail, {
      code,
      status: res.status,
      needsLogin: code === 'AUTH_REQUIRED',
      current: json?.data?.current ?? null,
    })
  }
  return json.data
}

export async function get(action: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<any> {
  const clean: Record<string, string> = { action }
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') clean[k] = String(v)
  }
  let res: Response
  try {
    res = await fetch(`${MAESTRO_URL}?${new URLSearchParams(clean)}`, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
      cache: 'no-store',
    })
  } catch {
    throw new ApiError('Could not reach Traction. Check your connection.', { code: 'NETWORK' })
  }
  return handle(res)
}

export async function post(action: string, payload: Record<string, unknown> = {}): Promise<any> {
  let res: Response
  try {
    res = await fetch(MAESTRO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action, ...payload }),
    })
  } catch {
    throw new ApiError('Could not reach Traction. Check your connection.', { code: 'NETWORK' })
  }
  return handle(res)
}

// ---------------------------------------------------------------- shared types

export interface Person { id: string; name: string; displayName: string; email: string; unitId?: string }

export interface Settings {
  schemaVersion: number
  displayName: string
  eosActive: boolean
  fiscalYearStartMonth: number
  weekEndsOn: number
  meetingDay: number
  scorecardCadences: string[]
  rev: number
}

export interface CompanyBrief {
  id: string
  name: string
  unitId: string
  settings: Settings
  periods: { week: string; month: string; quarter: string; year: string }
}

export interface Me { id: string; userId: string; name: string; email: string; unitId: string; isSuper: boolean }

export interface Bootstrap {
  me: Me
  companies: CompanyBrief[]
  team: Person[]
  multiCompany: boolean
}

export type CellStatus = 'green' | 'red' | 'empty' | 'none'

export interface Goal { op: string; target: number | null; target2: number | null }

export interface Cell {
  periodKey: string
  value: number | null
  status: CellStatus
  goal: Goal
  enteredBy: string
  at: string
}

export interface Measurable {
  id: string
  cadence: string
  ownerId: string
  ownerName: string
  active: boolean
  archivedAt: string | null
  title: string
  group: string
  valueType: string
  goal: Goal
  displayOrder: number
  rev: number
  cells: Cell[]
  escalate: boolean
  companyName?: string
}

export interface Scorecard {
  cadence: string
  periods: string[]
  currentPeriod: string
  rows: Measurable[]
}

export interface Milestone {
  id: string
  title: string
  dueDate: string
  ownerId: string
  done: boolean
  completedAt: string | null
}

export interface RockNote { id: string; at: string; byId: string; byName: string; body: string }

export interface Rock {
  id: string
  quarterKey: string
  ownerId: string
  ownerName: string
  status: 'on_track' | 'off_track' | 'done'
  companyRock: boolean
  dueDate: string | null
  archivedAt: string | null
  title: string
  description: string
  milestones: Milestone[]
  notes: RockNote[]
  carriedFrom?: string
  completedAt: string | null
  rev: number
  companyName?: string
}

export interface Origin { kind: string; id: string; label: string }

export interface Issue {
  id: string
  term: 'short' | 'long'
  status: 'open' | 'solved'
  priority: number | null
  createdDate: string | null
  archivedAt: string | null
  title: string
  description: string
  createdByName: string
  ownerId: string
  rank: number
  origin?: Origin
  solution: string | null
  solvedAt: string | null
  linkedTodoIds: string[]
  rev: number
}

export interface Todo {
  id: string
  ownerId: string
  ownerName: string
  status: 'open' | 'done'
  dueDate: string | null
  personal: boolean
  archivedAt: string | null
  title: string
  description: string
  createdByName: string
  completedAt: string | null
  origin?: Origin
  rev: number
  companyName?: string
}

export interface Headline {
  id: string
  type: 'customer' | 'employee'
  readDate: string | null
  archivedAt: string | null
  body: string
  createdByName: string
  createdAt: string
  rev: number
}

export interface AgendaItem { key: string; label: string; minutes: number }

export interface L10 {
  company: CompanyBrief
  weekLabel: string
  lastWeekLabel: string
  quarterKey: string
  agenda: AgendaItem[]
  scorecard: Scorecard
  rocks: Rock[]
  headlines: Headline[]
  todos: { rows: Todo[]; completed: number; total: number; pct: number | null; target: number }
  issues: Issue[]
}

export interface My90 {
  me: Me
  todos: Todo[]
  rocks: Rock[]
  milestones: { rockId: string; rockTitle: string; companyName: string; milestone: Milestone }[]
  measurables: Measurable[]
}

// --------------------------------------------------------------- typed actions

export const bootstrap = (): Promise<Bootstrap> => get('bootstrap')

export const getMy90 = (): Promise<My90> => get('my90')

export const getScorecard = (companyId: string, cadence = 'weekly', periods = 13): Promise<Scorecard> =>
  get('scorecard', { companyId, cadence, periods })

export const saveMeasurable = (fields: Record<string, unknown>): Promise<Measurable> =>
  post('saveMeasurable', fields)

export const setScore = (measurableId: string, periodKey: string, value: number | null): Promise<Measurable> =>
  post('setScore', { measurableId, periodKey, value })

export const bulkSetScores = (
  entries: { measurableId: string; periodKey: string; value: number | null }[],
): Promise<{ written: number; rows: Measurable[] }> => post('bulkSetScores', { entries })

export const archiveMeasurable = (id: string): Promise<unknown> => post('archiveMeasurable', { id })

export const getRocks = (companyId: string, quarterKey?: string, includeArchived = false): Promise<{ quarterKey: string; rows: Rock[] }> =>
  get('rocks', { companyId, quarterKey, includeArchived })

export const getRocksBoard = (companyId: string, quarterKey?: string): Promise<{ columns: { quarterKey: string; rows: Rock[] }[]; longTermIssues: Issue[] }> =>
  get('rocksBoard', { companyId, quarterKey })

export const saveRock = (fields: Record<string, unknown>): Promise<Rock> => post('saveRock', fields)

export const setRockStatus = (id: string, status: string, rev: number): Promise<Rock> =>
  post('setRockStatus', { id, status, rev })

export const saveMilestone = (rockId: string, milestone: Partial<Milestone> & { remove?: boolean }, rev: number): Promise<Rock> =>
  post('saveMilestone', { rockId, milestone, rev })

export const addRockNote = (rockId: string, body: string): Promise<Rock> => post('addRockNote', { rockId, body })

export const carryForwardRocks = (rockIds: string[], toQuarter: string): Promise<{ toQuarter: string; created: Rock[] }> =>
  post('carryForwardRocks', { rockIds, toQuarter })

export const getIssues = (companyId: string, term?: string, status?: string): Promise<{ rows: Issue[] }> =>
  get('issues', { companyId, term, status })

export const saveIssue = (fields: Record<string, unknown>): Promise<Issue> => post('saveIssue', fields)

export const rankIssues = (orderedIds: string[]): Promise<{ ranked: number }> => post('rankIssues', { orderedIds })

export const solveIssue = (id: string, solution: string, rev: number): Promise<Issue> =>
  post('solveIssue', { id, solution, rev })

export const archiveIssues = (ids: string[]): Promise<{ archived: number }> => post('archiveIssues', { ids })

export const dropToIssue = (fields: { companyId: string; title: string; origin?: Origin; description?: string; term?: string; priority?: number }): Promise<Issue> =>
  post('dropToIssue', fields)

export const getTodos = (companyId: string, mine = false, status?: string): Promise<{ rows: Todo[] }> =>
  get('todos', { companyId, mine, status })

export const saveTodo = (fields: Record<string, unknown>): Promise<Todo> => post('saveTodo', fields)

export const setTodoStatus = (id: string, status: string, rev: number): Promise<Todo> =>
  post('setTodoStatus', { id, status, rev })

export const createLinkedTodo = (fields: { issueId: string; title: string; ownerId?: string; ownerName?: string; dueDate?: string }): Promise<{ todo: Todo; issue: Issue }> =>
  post('createLinkedTodo', fields)

export const getHeadlines = (companyId: string, unreadOnly = false): Promise<{ rows: Headline[] }> =>
  get('headlines', { companyId, unreadOnly })

export const saveHeadline = (fields: Record<string, unknown>): Promise<Headline> => post('saveHeadline', fields)

export const markHeadlineRead = (ids: string[], unread = false): Promise<{ marked: number }> =>
  post('markHeadlineRead', { ids, unread })

export const getL10 = (companyId: string): Promise<L10> => get('l10', { companyId })

export const saveSettings = (fields: Record<string, unknown>): Promise<Settings> => post('saveSettings', fields)

export const searchStaff = (q: string): Promise<{ rows: Person[] }> => get('searchStaff', { q })
