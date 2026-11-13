export function effectiveIssueTeams(value: unknown, storageTeamId: string): string[] {
  if (value === undefined) return [storageTeamId]
  if (!Array.isArray(value)) return []
  const teams: string[] = []
  for (const id of value) if (typeof id === 'string' && id && teams.indexOf(id) < 0) teams.push(id)
  return teams
}
export function mergeIssueTeamSelection(previous: string[], selected: unknown, accessible: string[]): string[] {
  if (!Array.isArray(selected) || selected.some(id => typeof id !== 'string' || !id || accessible.indexOf(id) < 0)) throw new Error('Select only teams you can access.')
  const result = previous.filter(id => accessible.indexOf(id) < 0)
  for (const id of selected) if (result.indexOf(id) < 0) result.push(id)
  if (!result.length) throw new Error('Select at least one team for this issue.')
  return result
}
export function canAccessMappedIssue(issue: {assignedTeamIds?:unknown;meetingId?:string}, storageTeamId: string, selectedTeamId: string, accessible: string[], privateAllowed = false): boolean {
  if (accessible.indexOf(selectedTeamId) < 0) return false
  if (issue.meetingId) return storageTeamId === selectedTeamId && privateAllowed
  return effectiveIssueTeams(issue.assignedTeamIds, storageTeamId).indexOf(selectedTeamId) >= 0
}
