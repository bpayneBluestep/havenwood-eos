export function validateSourceUrl(value: string): string {
  const url = value.trim()
  if (url && !/^https?:\/\/[^\s/@?#]+(?:[/?#][^\s]*)?$/i.test(url)) throw new Error('Use an http:// or https:// source link without spaces or sign-in details.')
  return url
}
export function assignedTeams(sourceTeamId: string, ids?: string[]): string[] {
  const result = [sourceTeamId]
  for (const id of ids || []) if (typeof id === 'string' && id && result.indexOf(id) < 0) result.push(id)
  return result
}
export function validateAssignments(sourceTeamId: string, input: unknown, previous: string[], accessible: string[]): string[] {
  if (!Array.isArray(input) || input.some(id => typeof id !== 'string' || !id)) throw new Error('Assigned teams must be a list of team IDs.')
  const ids = assignedTeams(sourceTeamId, input)
  for (const id of ids) if (id !== sourceTeamId && previous.indexOf(id) < 0 && accessible.indexOf(id) < 0) throw new Error('Select only teams you can access.')
  return ids
}
export function canViewMeasurable(sourceTeamId: string, assigned: string[], selectedTeamId: string, accessible: string[]): boolean {
  return accessible.indexOf(selectedTeamId) >= 0 && (selectedTeamId === sourceTeamId || assigned.indexOf(selectedTeamId) >= 0)
}
export function compareMeasurables(a: {group: string; groupOrder?: number; displayOrder?: number}, b: {group: string; groupOrder?: number; displayOrder?: number}): number {
  if ((a.groupOrder ?? 999) !== (b.groupOrder ?? 999)) return (a.groupOrder ?? 999) - (b.groupOrder ?? 999)
  if (a.group !== b.group) return a.group < b.group ? -1 : 1
  return (a.displayOrder ?? 999) - (b.displayOrder ?? 999)
}
export function planSections(rows: {id:string;rev:number;group:string}[], sections: {name:string;newName:string}[], revisions: {id:string;rev:number}[]): {id:string;group:string;order:number}[] {
  if (!Array.isArray(sections) || !Array.isArray(revisions)) throw new Error('Sections and revisions are required.')
  const names: string[] = []
  for (const row of rows) if (names.indexOf(row.group || '') < 0) names.push(row.group || '')
  if (sections.length !== names.length || revisions.length !== rows.length) throw new Error('The scorecard changed. Reload it before saving sections.')
  const oldNames: string[] = [], newNames: string[] = [], revisionIds: string[] = []
  for (const revision of revisions) {
    if (!revision || typeof revision.id !== 'string' || revisionIds.indexOf(revision.id) >= 0) throw new Error('Invalid scorecard revisions.')
    revisionIds.push(revision.id)
  }
  for (const section of sections) {
    if (!section || typeof section.name !== 'string' || typeof section.newName !== 'string' || names.indexOf(section.name) < 0 || oldNames.indexOf(section.name) >= 0) throw new Error('Each existing section must appear once.')
    const name = section.newName.trim().toLowerCase()
    if (newNames.indexOf(name) >= 0) throw new Error('Use a different name for each section.')
    oldNames.push(section.name); newNames.push(name)
  }
  return rows.map(row => {
    const revision = revisions.find(item => item.id === row.id)
    if (!revision || revision.rev !== row.rev) throw new Error('The scorecard changed. Reload it before saving sections.')
    const order = oldNames.indexOf(row.group || '')
    return {id:row.id, group:sections[order].newName.trim(), order}
  })
}

export function orderMeasurables<T extends {group:string;groupOrder?:number;displayOrder?:number}>(rows:T[]):T[] {
  const orders: {name:string;order:number}[] = []
  for (const row of rows) {
    const group = orders.find(item => item.name === row.group)
    if (group) group.order = Math.min(group.order, row.groupOrder ?? 999)
    else orders.push({name:row.group,order:row.groupOrder ?? 999})
  }
  return rows.map(row => ({...row,groupOrder:orders.find(item => item.name === row.group)!.order})).sort(compareMeasurables)
}

export function withTeamSection(definition: {rev?:number;sectionByTeam?:Record<string,{name:string;order:number}>;[key:string]:unknown}, teamId:string, section:{group:string;order:number}) {
  const existing = definition.sectionByTeam && typeof definition.sectionByTeam === 'object' && !Array.isArray(definition.sectionByTeam) ? definition.sectionByTeam : {}
  return {...definition,sectionByTeam:{...existing,[teamId]:{name:section.group,order:section.order}},rev:(Number(definition.rev) || 0)+1}
}

export function alignScorePeriods<T extends {periodKey:string}>(cells:T[], viewPeriods:string[]):(T & {scorePeriodKey:string})[] {
  return cells.map((cell,index) => ({...cell,scorePeriodKey:cell.periodKey,periodKey:viewPeriods[index] || cell.periodKey}))
}
