export type RockStatus = 'on_track' | 'off_track' | 'done'
export function calculateRockStatus(rock: {status: RockStatus; milestones: {done: boolean; dueDate: string}[]}, today: string): RockStatus {
  if (!rock.milestones.length) return rock.status
  if (rock.milestones.every(item => item.done)) return 'done'
  return rock.milestones.some(item => !item.done && !!item.dueDate && item.dueDate < today) ? 'off_track' : 'on_track'
}
