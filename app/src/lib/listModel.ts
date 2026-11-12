export function displayName(name?: string): string {
  const value = (name || '').trim()
  const comma = value.indexOf(',')
  return comma > 0 ? `${value.slice(comma + 1).trim()} ${value.slice(0, comma).trim()}`.trim() : value
}
export function compareNames(a?: string, b?: string): number {
  const left = displayName(a), right = displayName(b)
  if (!left || !right) return left ? -1 : right ? 1 : 0
  return left.localeCompare(right, undefined, {sensitivity: 'base', numeric: true})
}
export function compareDates(a?: string | null, b?: string | null, newest = false): number {
  if (!a || !b) return a ? -1 : b ? 1 : 0
  return newest ? b.localeCompare(a) : a.localeCompare(b)
}
export function isOverdue(item: {status: string; dueDate: string | null}, today: string): boolean {
  return item.status === 'open' && !!item.dueDate && item.dueDate < today
}
export const priorityLabels = ['Unranked', '1 — Lowest', '2 — Low', '3 — Medium', '4 — High', '5 — Highest']
export function priorityLabel(priority: number | null): string {
  return priority !== null && Number.isInteger(priority) && priority >= 1 && priority <= 5 ? priorityLabels[priority] : priorityLabels[0]
}
export function newestPeriods(periods: string[]): string[] {
  return [...periods].sort((a, b) => b.localeCompare(a))
}
