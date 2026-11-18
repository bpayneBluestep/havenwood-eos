import {it,expect} from 'vitest'
import {weekSundayLabel} from './periodLabels'
it('labels the Sunday before each ISO week without shifting stored periods',()=>{
 expect(weekSundayLabel('2026-W47')).toBe('Nov 15')
 expect(weekSundayLabel('2026-W01')).toBe('Dec 28')
 expect(weekSundayLabel('2026-W53')).toBe('Dec 27')
 expect(weekSundayLabel('2025-W53')).toBe('')
 expect(weekSundayLabel('2026-11')).toBe('')
})
