import {useId,useMemo} from 'react'
import type {ItemRecurrence,RecurrencePreset} from '../../../platform/itemRecurrence'
import {defaultRecurrence,normalizeRecurrence,recurrenceLabel} from '../../../platform/itemRecurrence'
import {todayIso} from '../lib/ui'

const WEEKDAYS = [
  {value: 0, label: 'Sun'},
  {value: 1, label: 'Mon'},
  {value: 2, label: 'Tue'},
  {value: 3, label: 'Wed'},
  {value: 4, label: 'Thu'},
  {value: 5, label: 'Fri'},
  {value: 6, label: 'Sat'},
]

export function recurrencePayload(enabled: boolean, draft: ItemRecurrence | null): ItemRecurrence | null {
  if (!enabled || !draft) return null
  return normalizeRecurrence(draft, draft.start || todayIso())
}

export default function CadenceBuilder({
  enabled,
  value,
  onEnabledChange,
  onChange,
  defaultStart,
  onStartChange,
}: {
  enabled: boolean
  value: ItemRecurrence | null
  onEnabledChange: (enabled: boolean) => void
  onChange: (value: ItemRecurrence | null) => void
  defaultStart?: string
  /** When the cadence first-due date changes, keep the parent due/date field in sync. */
  onStartChange?: (start: string) => void
}) {
  const uid = useId()
  const start = value?.start || defaultStart || todayIso()
  const preset: RecurrencePreset = !enabled || !value
    ? 'off'
    : value.freq === 'custom'
      ? 'custom'
      : value.freq === 'biweekly'
        ? 'biweekly'
        : value.freq === 'monthly'
          ? 'monthly'
          : 'weekly'

  const summary = useMemo(() => recurrenceLabel(enabled ? value : null), [enabled, value])

  const setPreset = (next: RecurrencePreset) => {
    if (next === 'off') {
      onEnabledChange(false)
      onChange(null)
      return
    }
    onEnabledChange(true)
    const base = value || defaultRecurrence(start, next === 'custom' ? 'custom' : next)
    onChange(defaultRecurrence(base.start || start, next === 'custom' ? 'custom' : next))
  }

  const patch = (partial: Partial<ItemRecurrence>) => {
    const base = value || defaultRecurrence(start, 'weekly')
    const next = {...base, ...partial}
    onEnabledChange(true)
    onChange(next)
    if (partial.start) onStartChange?.(partial.start)
  }

  const toggleWeekday = (day: number) => {
    const base = value || defaultRecurrence(start, 'custom')
    const has = base.weekdays.includes(day)
    const weekdays = has ? base.weekdays.filter(item => item !== day) : [...base.weekdays, day].sort((a, b) => a - b)
    patch({freq: 'custom', weekdays})
  }

  return (
    <fieldset className="cadence-builder" aria-label="Recurrence">
      <legend className="cadence-builder__legend">Recurring schedule</legend>
      <label className="field cadence-builder__toggle">
        <span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={event => {
              if (event.target.checked) {
                onEnabledChange(true)
                const next = value || defaultRecurrence(start, 'weekly')
                onChange(next)
                onStartChange?.(next.start)
              } else {
                onEnabledChange(false)
                onChange(null)
              }
            }}
          />{' '}
          Make this recurring
        </span>
      </label>

      {enabled && (
        <>
          <div className="row2">
            <div className="field">
              <label htmlFor={`${uid}-preset`}>Cadence</label>
              <select
                id={`${uid}-preset`}
                className="select"
                aria-label="Recurrence cadence"
                value={preset}
                onChange={event => setPreset(event.target.value as RecurrencePreset)}
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom weekdays…</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${uid}-start`}>First due date</label>
              <input
                id={`${uid}-start`}
                className="input"
                type="date"
                value={start}
                onChange={event => patch({start: event.target.value})}
              />
            </div>
          </div>

          {(preset === 'weekly' || preset === 'biweekly' || preset === 'custom') && (
            <div className="field">
              <label htmlFor={`${uid}-interval`}>Every N weeks</label>
              <input
                id={`${uid}-interval`}
                className="input"
                type="number"
                min={preset === 'biweekly' ? 2 : 1}
                max={52}
                value={value?.interval ?? (preset === 'biweekly' ? 2 : 1)}
                onChange={event => patch({interval: Number(event.target.value) || 1, freq: preset === 'custom' ? 'custom' : preset === 'biweekly' ? 'biweekly' : 'weekly'})}
              />
            </div>
          )}

          {preset === 'monthly' && (
            <div className="field">
              <label htmlFor={`${uid}-months`}>Every N months</label>
              <input
                id={`${uid}-months`}
                className="input"
                type="number"
                min={1}
                max={24}
                value={value?.interval ?? 1}
                onChange={event => patch({interval: Number(event.target.value) || 1, freq: 'monthly'})}
              />
            </div>
          )}

          {(preset === 'custom' || preset === 'weekly' || preset === 'biweekly') && (
            <div className="field">
              <span className="cadence-builder__weekdays-label">Weekdays</span>
              <div className="cadence-builder__weekdays" role="group" aria-label="Recurrence weekdays">
                {WEEKDAYS.map(day => (
                  <label key={day.value} className="cadence-builder__day">
                    <input
                      type="checkbox"
                      checked={(value?.weekdays || []).includes(day.value)}
                      onChange={() => {
                        if (preset === 'custom') toggleWeekday(day.value)
                        else patch({weekdays: [day.value], freq: preset === 'biweekly' ? 'biweekly' : 'weekly'})
                      }}
                    />
                    {day.label}
                  </label>
                ))}
              </div>
              {preset !== 'custom' && <div className="field__hint">Pick one weekday, or switch to Custom for several.</div>}
            </div>
          )}

          <div className="field">
            <label htmlFor={`${uid}-until`}>Ends (optional)</label>
            <input
              id={`${uid}-until`}
              className="input"
              type="date"
              value={value?.until || ''}
              onChange={event => patch({until: event.target.value || null})}
            />
          </div>

          {summary && <p className="muted cadence-builder__summary" role="status">{summary}{value?.until ? ` · ends ${value.until}` : ''}</p>}
        </>
      )}
    </fieldset>
  )
}
