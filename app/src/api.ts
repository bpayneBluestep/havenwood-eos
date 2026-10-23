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
  /** Signed in, but not on any EOS team: the endpoint answered AUTH_REQUIRED itself. */
  noAccess: boolean
  /** On STALE, the server's current copy of the entity so the UI can re-render. */
  current: any

  constructor(message: string, opts: { code?: string; status?: number; needsLogin?: boolean; noAccess?: boolean; current?: any } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = opts.code || 'REQUEST_FAILED'
    this.status = opts.status ?? 0
    this.needsLogin = !!opts.needsLogin
    this.noAccess = !!opts.noAccess
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
    // A JSON AUTH_REQUIRED came from the endpoint's own code, so the session is
    // signed in (Login mode redirects a signed-out one before the code runs) —
    // it means "no Traction access", not "sign in".
    throw new ApiError(detail, {
      code,
      status: res.status,
      noAccess: code === 'AUTH_REQUIRED',
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

/**
 * One of the caller's TEAMS (ticket #269). The type keeps its old name because
 * a company team's id is still its Facility id, and every screen that took a
 * company takes a team unchanged.
 */
export interface CompanyBrief {
  id: string
  name: string
  /** 'company' = a company's own leadership team; 'custom' = a team an admin made. */
  kind?: 'company' | 'custom'
  /** The company whose record holds this team's data. */
  homeId?: string
  homeName?: string
  unitId: string
  settings: Settings
  periods: { week: string; month: string; quarter: string; year: string }
}

export interface Me { id: string; userId: string; name: string; email: string; unitId: string; isSuper: boolean; fullAccess?: boolean; isAdmin?: boolean }

export interface Bootstrap {
  me: Me
  companies: CompanyBrief[]
  /** Roster of the default company. Prefer `teams[companyId]`. */
  team: Person[]
  /** Per team: its members. */
  teams?: Record<string, Person[]>
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
  /** Raised into the parent unit's roll-up view. Visibility only — grants nothing. */
  rollUp: boolean
  /** Which company the rock actually lives on. Present on every row. */
  companyId?: string
  /** True when the row came from a team other than the selected one. */
  foreign?: boolean
  companyName?: string
  teamKind?: 'company' | 'custom'
  /** Rolled up from a custom team you aren't on: shown, never editable here. */
  readOnly?: boolean
}

export interface Origin { kind: string; id: string; label: string }

export interface Issue {
  id: string
  /** Set when the item belongs to a private meeting. */
  meetingId?: string
  occurrenceDate?: string | null
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
  /** Set when the item belongs to a private meeting. */
  meetingId?: string
  occurrenceDate?: string | null
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
  /** Set when the item belongs to a private meeting. */
  meetingId?: string
  occurrenceDate?: string | null
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

/*
 * Rock scope — how far up the org tree a list reaches.
 *   own     the selected company only                       (everyone's default)
 *   rolled  the selected company + rocks raised from beneath it
 *   all     every company the caller resolves to
 * Scope can only narrow what the server's tenancy pin already returned, so an
 * operating-unit user gets the same single company whichever one they ask for.
 */
export type RockScope = 'own' | 'rolled' | 'all'

export interface RockScopeCounts { own: number; rolled: number; all: number; companies: number }

export const getRocks = (
  companyId: string, quarterKey?: string, includeArchived = false, scope: RockScope = 'own',
): Promise<{ quarterKey: string; scope: RockScope; rows: Rock[]; counts: RockScopeCounts }> =>
  get('rocks', { companyId, quarterKey, includeArchived, scope })

export const getRocksBoard = (
  companyId: string, quarterKey?: string, scope: RockScope = 'own',
): Promise<{ columns: { quarterKey: string; rows: Rock[] }[]; longTermIssues: Issue[]; scope: RockScope }> =>
  get('rocksBoard', { companyId, quarterKey, scope })

export const setRockRollUp = (id: string, rollUp: boolean, rev: number): Promise<Rock> =>
  post('setRockRollUp', { id, rollUp, rev })

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

/** Admins only — everyone else gets NOT_FOUND. */
export const saveSettings = (fields: Record<string, unknown>): Promise<Settings> => post('saveSettings', fields)

// ------------------------------------------------------------- admin (#269)
// Every admin action answers NOT_FOUND unless the caller is an EOS admin.

export interface AdminTeam {
  id: string
  kind: 'company' | 'custom'
  name: string
  homeId: string
  homeName: string
  memberCount: number
  archivedAt: string | null
  eosActive: boolean
  settings: Settings
  /** Guards membership and a custom team's definition. */
  rev: number
  /** Guards a company team's settings. */
  settingsRev: number
}

export interface AdminMember { id: string; name: string; email: string; former: boolean }

export interface AdminPerson { id: string; name: string; email: string; former: boolean; isAdmin: boolean; teamIds: string[] }

export interface AuditRow {
  at: string
  action: string
  actorId: string
  actorName: string
  teamId: string
  teamName: string
  personId: string
  personName: string
  detail: any
}

export const adminOverview = (): Promise<{ teams: AdminTeam[]; companies: { id: string; name: string }[]; admins: { id: string; name: string }[]; reach: string }> =>
  get('adminOverview')

export const adminTeam = (teamId: string): Promise<{ team: AdminTeam; members: AdminMember[] }> =>
  get('adminTeam', { companyId: teamId })

export const adminSaveTeam = (fields: Record<string, unknown>): Promise<{ team: AdminTeam }> => post('adminSaveTeam', fields)

export const adminSetMembership = (teamId: string, personId: string, member: boolean, rev: number): Promise<{ team: AdminTeam }> =>
  post('adminSetMembership', { companyId: teamId, personId, member, rev })

export const adminPeople = (q = ''): Promise<{ rows: AdminPerson[] }> => get('adminPeople', { q })

export const adminAudit = (filters: { teamId?: string; personId?: string } = {}): Promise<{ rows: AuditRow[]; more: boolean }> =>
  get('adminAudit', { companyId: filters.teamId, personId: filters.personId })

/** Only people with access to the company — an owner must be able to see what they own. */
export const searchStaff = (q: string, companyId?: string): Promise<{ rows: Person[] }> => get('searchStaff', { q, companyId })

// ---------------------------------------------------------- private meetings

/*
 * A meeting is visible to its attendees only, like a Google Calendar invite:
 * the series list sees every date; someone added to one date sees that date.
 * The server decides all of it — this file only carries the answers.
 */

export type MeetingFreq = 'none' | 'weekly' | 'biweekly' | 'monthly'

export interface Recurrence { freq: MeetingFreq; start: string; until: string }

export interface PersonRef { id: string; name: string }

export interface Meeting {
  id: string
  companyId: string
  companyName: string
  kind: string
  title: string
  attendees: PersonRef[]
  recurrence: Recurrence
  nextDate: string | null
  archivedAt: string | null
  /** Series attendees may edit; someone added to one date may not. */
  canEdit: boolean
  rev: number
}

export interface Occurrence { date: string; cancelled: boolean; attendees: PersonRef[]; changed: boolean }

export interface MeetingOccurrence {
  meeting: Meeting
  date: string
  cancelled: boolean
  attendees: PersonRef[]
  issues: Issue[]
  todos: Todo[]
  headlines: Headline[]
}

export const getMeetings = (companyId: string, includeArchived = false): Promise<{ rows: Meeting[] }> =>
  get('meetings', { companyId, includeArchived })

export const getMeeting = (id: string, from?: string, to?: string): Promise<{ meeting: Meeting; occurrences: Occurrence[]; roster: Person[] }> =>
  get('meeting', { id, from, to })

export const getMeetingOccurrence = (id: string, date: string): Promise<MeetingOccurrence> =>
  get('meetingOccurrence', { id, date })

export const saveMeeting = (fields: {
  id?: string; companyId?: string; title: string; attendeeIds: string[]; recurrence: Recurrence; rev?: number
}): Promise<Meeting> => post('saveMeeting', fields)

export const setOccurrenceAttendees = (fields: {
  id: string; date: string; add: string[]; remove: string[]; cancelled?: boolean; rev: number
}): Promise<Meeting> => post('setOccurrenceAttendees', fields)

export const archiveMeeting = (id: string, restore = false): Promise<Meeting> => post('archiveMeeting', { id, restore })

// ------------------------------------------------------------- sign in / out

/*
 * In-app sign-in, ported from ec-crm-gitsite. BlueStep login is a same-origin
 * FORM post to the tenant login handler (no CSRF token is required), which
 * flips this host's session cookie to signed-in. Success is confirmed by
 * calling bootstrap again, never by parsing the login page's HTML.
 * The password only ever goes to this same-origin BlueStep host.
 */
const LOGIN_URL = '/shared/login/login.jsp'

function loginFields(username: string, password: string): Record<string, string> {
  return {
    _postEvent: 'commit',
    _postFormClass: 'myassn.user.UserLoginWebView',
    step: 'two', // != "one": log in now, skipping the step-one round-trip
    myUserName: username,
    myPassword: password,
    rememberMe: 'false',
  }
}

export type LoginResult =
  | { ok: true; data: Bootstrap }
  | { ok: false; twoFactor?: boolean; noAccess?: boolean; error?: string }

export async function login(username: string, password: string): Promise<LoginResult> {
  let res: Response
  try {
    res = await fetch(LOGIN_URL, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(loginFields(username, password)).toString(),
    })
  } catch {
    return { ok: false, error: 'Could not reach the sign-in service. Check your connection and try again.' }
  }
  // Global users on an untrusted device are sent to email 2FA.
  if (res.redirected && /\/oauth2\/v1\/login\/verify/.test(res.url)) return { ok: false, twoFactor: true }
  try {
    return { ok: true, data: await bootstrap() }
  } catch (e) {
    if (e instanceof ApiError && e.noAccess) return { ok: false, noAccess: true }
    if (e instanceof ApiError && !e.needsLogin) return { ok: false, error: e.message }
    return { ok: false, error: 'The username or password you entered is invalid.' }
  }
}

/*
 * Email 2FA can't finish inside a fetch, so hand the same credentials to the
 * platform as a full-page post; it shows its code page, then returns to `dest`.
 */
export function nativeLoginSubmit(username: string, password: string, dest: string): void {
  const f = document.createElement('form')
  f.method = 'POST'
  f.action = LOGIN_URL + '?desturl=' + encodeURIComponent(dest)
  f.style.display = 'none'
  for (const [n, v] of Object.entries(loginFields(username, password))) {
    const i = document.createElement('input')
    i.type = 'hidden'; i.name = n; i.value = v
    f.appendChild(i)
  }
  document.body.appendChild(f)
  f.submit()
}

/** Ends the BlueStep session; the caller then shows the sign-in form again. */
export async function logout(): Promise<void> {
  try { await fetch('/shared/login/logout.jsp', { credentials: 'include', cache: 'no-store' }) } catch { /* drop to the form anyway */ }
}
