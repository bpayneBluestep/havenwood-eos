import type {CompanyBrief} from '../api'
export default function IssueTeamPicker({teams,selected,onChange,disabled}: {teams: CompanyBrief[];selected:string[];onChange:(ids:string[])=>void;disabled?:boolean}) {
  return <fieldset className="field team-assignments" aria-label="Issue team mappings" disabled={disabled}>
    <legend>Teams</legend>
    <p className="field__hint">Select at least one team. Each selected team can view and edit the same issue.</p>
    {teams.map(team => <label key={team.id}><input type="checkbox" checked={selected.includes(team.id)} onChange={event => onChange(event.target.checked ? [...selected,team.id] : selected.filter(id => id !== team.id))}/>{team.name}</label>)}
  </fieldset>
}
