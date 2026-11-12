import {useState} from 'react'
import type {Milestone} from '../api'
import {dueClass, fmtDate} from '../lib/ui'
export default function MilestoneDate({item, disabled, onSave}: {
  item: Milestone; disabled?: boolean; onSave: (date: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState(item.dueDate || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    setSaving(true); setError('')
    try { await onSave(date); setEditing(false) }
    catch (error: unknown) { setError(error instanceof Error ? error.message : 'Could not save the date.') }
    finally { setSaving(false) }
  }
  if (!editing) return <button type="button" className={'date-edit mono faint ' + dueClass(item.dueDate, item.done)} disabled={disabled} aria-label={`Edit due date for ${item.title}`} title="Edit due date" onClick={() => {setDate(item.dueDate || ''); setError(''); setEditing(true)}}>{item.dueDate ? fmtDate(item.dueDate) : 'Add due date'}</button>
  return <span className="date-editor" onKeyDown={event => {
    if (event.key === 'Escape' && !saving) {event.stopPropagation(); setEditing(false)}
    if (event.key === 'Enter') {event.preventDefault(); if (!saving && !disabled) void save()}
  }}><input className="input" type="date" autoFocus aria-label={`Due date for ${item.title}`} value={date} disabled={saving || disabled} onChange={event => setDate(event.target.value)}/><button type="button" className="btn btn--sm" disabled={saving || disabled} onClick={save}>{saving ? 'Saving…' : 'Save'}</button><button type="button" className="btn btn--sm" disabled={saving} onClick={() => setEditing(false)}>Cancel</button>{error && <span role="alert" className="overdue">{error}</span>}</span>
}
