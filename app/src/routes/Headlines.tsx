import QuickCreateButtons from '../components/QuickCreateButtons'
import {compareNames, compareDates} from '../lib/listModel'
import FollowupContext from '../meetings/FollowupContext'
import { useCallback, useEffect, useState } from 'react'
import { getHeadlines, saveHeadline, cascadeHeadline, markHeadlineRead } from '../api'
import type { Headline } from '../api'
import { useApp } from '../state'
import { Avatar, PersonName, Empty, ErrorBanner, Loading, Modal, OwnerPicker,fmtDate } from '../lib/ui'
import { DropToIssueModal } from '../components/DropToIssue'

/*
 * One or two sentences. Good news and personnel news — the things a team should
 * hear but not discuss. If it needs discussing it becomes an Issue.
 *
 * Roll-forward is free: the L10 reads unread headlines, so anything not ticked
 * simply shows up again next week. No extra state and no scheduled job.
 */
export default function Headlines({embedded=false,companyId}:{embedded?:boolean;companyId?:string}) {
  const { company,companies } = useApp()
  const targetCompanyId=companyId||company.id
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [rows, setRows] = useState<Headline[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [permanentNew,setPermanentNew]=useState(false)
  const [cascadeFor,setCascadeFor]=useState<Headline|null>(null)
  const [targetTeam,setTargetTeam]=useState('')
  const [busy,setBusy]=useState(false)
  const [savingIds,setSavingIds]=useState<Record<string,boolean>>({})
  const [checked,setChecked]=useState<Record<string,boolean>>({})
  const [editing,setEditing]=useState<Headline|null>(null)
  const [detail, setDetail] = useState<Headline | null>(null)
  const [sort, setSort] = useState('newest')
  const [permanentSort,setPermanentSort]=useState('newest')
  const [dropFor, setDropFor] = useState<Headline | null>(null)

  const load = useCallback(() => {
    setErr(null)
    getHeadlines(targetCompanyId, unreadOnly).then(r => setRows(r.rows)).catch(e => setErr(e.message))
  }, [targetCompanyId, unreadOnly])

  useEffect(() => { setRows(null); load();if(!embedded)return;const timer=window.setInterval(load,10000);return()=>window.clearInterval(timer) }, [load,embedded])

  const unread = rows ? rows.filter(r => !r.readDate) : []
  const ordered=(order:string)=>[...(rows||[])].sort((a,b)=>order === 'author' ? compareNames(a.createdByName, b.createdByName) : order === 'author-desc' ? compareNames(b.createdByName, a.createdByName) : compareDates(a.createdAt, b.createdAt, order === 'newest'))
  const visible=ordered(sort)
  const permanentRows=ordered(permanentSort).filter(h=>h.permanent??/PERMANENT AGENDA ITEM/i.test(h.body))

  return (
    <div className={embedded?"meeting-headlines":"page"}>
      <div className="page__head">
        <div>
          {!embedded&&<h1>Headlines</h1>}
          <div className="page__sub">
            Customer and employee news, one or two sentences.
          </div>
        </div>
        <div className="page__actions"><label className="sort-control">Sort headlines<select className="select" value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="author">Author A–Z</option><option value="author-desc">Author Z–A</option></select></label>
          <button className="btn" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(u => !u)}>
            {unreadOnly ? 'Show all' : `Unread only${unread.length ? ` (${unread.length})` : ''}`}
          </button>
          <QuickCreateButtons companyId={targetCompanyId} onSaved={load}/>
        </div>
      </div>

      <ErrorBanner error={err} onDismiss={() => setErr(null)} />

      <section className="card permanent-headlines" aria-label="Permanent headlines">
        <div className="card__head headline-ribbon"><h2>Permanent headlines</h2><label className="sort-control">Sort permanent headlines<select className="select" value={permanentSort} onChange={event=>setPermanentSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="author">Author A–Z</option><option value="author-desc">Author Z–A</option></select></label><button className="btn btn--sm" onClick={()=>{setPermanentNew(true);setAdding(true)}}>+ Permanent headline</button></div>
        {permanentRows.map(h=><div className="permanent-headline" key={h.id}>
          <input type="checkbox" aria-label={`Reviewed: ${h.body}`} checked={!!checked[h.id]} onChange={event=>setChecked({...checked,[h.id]:event.target.checked})}/>
          <button className="rowitem__title-link" title={h.body} onClick={()=>setDetail(h)}>{h.body.split(/\r?\n/)[0].replace(/\s*\(PERMANENT AGENDA ITEM\)/ig,'')}</button>
          {h.sourceUrl&&/^https?:\/\//i.test(h.sourceUrl)&&<a className="btn btn--sm" href={h.sourceUrl} target="_blank" rel="noopener noreferrer">{(!h.sourceLabel||h.sourceLabel==='Open source')?'Open link':h.sourceLabel}</a>}
          <button className="btn btn--sm" onClick={()=>setDropFor(h)}>Drop to Issues</button><button className="btn btn--sm" onClick={()=>{setTargetTeam('');setCascadeFor(h)}}>Cascade</button>
        </div>)}
        {rows&&!rows.some(h=>h.permanent??/PERMANENT AGENDA ITEM/i.test(h.body))&&<p className="muted">Add recurring review items and source links here.</p>}
      </section>
      <div className="card__head headline-ribbon headline-new-ribbon"><h2>New headlines</h2></div>
      {!rows ? (
        <Loading what="Loading headlines" />
      ) : rows.length === 0 ? (
        <div className="card">
          <Empty title="No headlines">
            Wins, losses, feedback, someone's good news. Anything the team should hear but doesn't
            need to debate.
          </Empty>
        </div>
      ) : (
        <div className="card card__body--flush">
          <div className="rows">
            {visible.filter(h=>!(h.permanent??/PERMANENT AGENDA ITEM/i.test(h.body))).map(h => (
              <div className={'rowitem rowitem--clickable headline-row' + (h.readDate ? ' rowitem--done' : '')} key={h.id} onClick={() => setDetail(h)}>
                <input type="checkbox" aria-label={`Complete headline: ${h.body}`} checked={!!h.readDate} disabled={!!savingIds[h.id]||h.readOnly} onClick={event=>event.stopPropagation()} onChange={async event=>{
                  const complete=event.target.checked;setSavingIds(ids=>({...ids,[h.id]:true}));
                  try{const result=await markHeadlineRead([h.id],!complete);if(result.marked!==1)throw Error('Headline was not updated. Reload and try again.');setRows(items=>items?.map(item=>item.id===h.id?{...item,readDate:complete?new Date().toISOString().slice(0,10):null}:item)||null)}catch(error:any){setErr(error.message)}finally{setSavingIds(ids=>({...ids,[h.id]:false}))}
                }}/>
                <div className="rowitem__owner"><Avatar name={h.ownerName||h.createdByName} id={h.ownerId||h.createdByName} sm/><PersonName name={h.ownerName||h.createdByName} id={h.ownerId}/></div>
                <time className="headline-date muted" dateTime={h.createdAt?.slice(0,10)} title="Publication date">{h.createdAt?fmtDate(h.createdAt.slice(0,10)):'—'}</time>
                <div className="rowitem__main">
                  <div className="rowitem__title">
                    <button type="button" className="rowitem__title-link headline-preview" aria-label={`Open headline: ${h.body.slice(0, 120)}`} onClick={event => {event.stopPropagation(); setDetail(h)}}>{h.body.split(/\r?\n/)[0].slice(0, 140)}{h.body.length > 140 || h.body.includes('\n') ? '…' : ''}</button><FollowupContext hideOwner item={h}/>

                  </div>

                </div>
                {!h.readOnly&&<div className="rowitem__end" onClick={event => event.stopPropagation()}>
                  <button className="btn btn--sm" onClick={()=>setDropFor(h)}>Drop to Issues</button>
                  <button className="btn btn--sm" onClick={()=>{setTargetTeam('');setCascadeFor(h)}}>Cascade</button>
                </div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {detail && <Modal title="Headline details" onClose={() => setDetail(null)}><p className="muted"><PersonName name={detail.createdByName}/>{detail.createdAt ? ` · ${fmtDate(detail.createdAt.slice(0, 10))}` : ''}</p><div className="detail-body">{detail.body}</div>{detail.sourceUrl&&/^https?:\/\//i.test(detail.sourceUrl)&&<a className="btn" href={detail.sourceUrl} target="_blank" rel="noopener noreferrer">{(!detail.sourceLabel||detail.sourceLabel==='Open source')?'Open link':detail.sourceLabel}</a>}{!detail.readOnly&&<button className="btn" onClick={()=>{setEditing(detail);setDetail(null)}}>Edit headline</button>}</Modal>}
      {editing&&<Modal title="Edit headline" onClose={()=>setEditing(null)}><HeadlineForm companyId={targetCompanyId} initial={editing} onDone={()=>{setEditing(null);load()}} onCancel={()=>setEditing(null)}/></Modal>}
      {cascadeFor&&<Modal title="Cascade headline" onClose={()=>setCascadeFor(null)}><p>Publish a separate copy to another team.</p><label className="field">Team<select className="select" value={targetTeam} onChange={event=>setTargetTeam(event.target.value)}><option value="">Select a team</option>{companies.filter(team=>team.id!==targetCompanyId).map(team=><option key={team.id} value={team.id}>{team.name}</option>)}</select></label><button className="btn btn--primary" disabled={!targetTeam||busy} onClick={async()=>{setBusy(true);try{await cascadeHeadline(cascadeFor.id,targetTeam);setCascadeFor(null)}catch(error:any){setErr(error.message)}finally{setBusy(false)}}}>{busy?'Publishing…':'Publish headline'}</button></Modal>}
      {adding && (
        <Modal title="New headline" onClose={() => setAdding(false)}>
          <HeadlineForm companyId={targetCompanyId} permanentDefault={permanentNew} onDone={() => { setAdding(false); load() }} onCancel={() => setAdding(false)} />
        </Modal>
      )}

      {dropFor && (
        <DropToIssueModal
          origin={{ kind: 'headline', id: dropFor.id, label: dropFor.body }}
          suggestedTitle={dropFor.body}
          onClose={() => setDropFor(null)}
        />
      )}
    </div>
  )
}

export function HeadlineForm({
  companyId, onDone, onCancel, initial, permanentDefault=false,
}: { companyId: string; initial?:Headline; permanentDefault?:boolean; onDone: () => void; onCancel?: () => void }) {
  const {team,teams,me}=useApp()
  const people=[...new Map(Object.values(teams||{current:team}).flat().map(person=>[person.id,person])).values()]
  const [ownerId,setOwnerId]=useState(initial?.ownerId||me.id)
  const [ownerName,setOwnerName]=useState(initial?.ownerName||me.name)
  const [body, setBody] = useState(initial?.body||'')
  const [permanent,setPermanent]=useState(initial?.permanent??permanentDefault)
  const [sourceUrl,setSourceUrl]=useState(initial?.sourceUrl||'')
  const [sourceLabel,setSourceLabel]=useState(!initial?.sourceLabel||initial.sourceLabel==='Open source'?'Open link':initial.sourceLabel)
  const type = initial?.type||'customer'
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!body.trim()) { setErr('A headline needs some words.'); return }
    setBusy(true); setErr(null)
    try { await saveHeadline({ companyId, id:initial?.id,rev:initial?.rev,body: body.trim(), type, permanent,sourceUrl,sourceLabel,ownerId,ownerName }); setBody(''); onDone() }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false) }
  }

  return (
    <>
      <ErrorBanner error={err} onDismiss={() => setErr(null)} />
      <div className="field">
        <label htmlFor="h-body">Headline</label>
        <textarea
          id="h-body" className="textarea" autoFocus value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Two families completed the parent workshop and asked to co-lead the next one."
        />
        <div className="field__hint">One or two sentences. If it needs discussion, make it an Issue.</div>
      </div>
      <label className="field">Owner<OwnerPicker team={people} value={ownerId} valueName={ownerName} onChange={(id,name)=>{setOwnerId(id);setOwnerName(name)}}/></label>
      <label className="field"><span><input type="checkbox" checked={permanent} onChange={event=>setPermanent(event.target.checked)}/> Permanent review item</span></label>
      <label className="field">Source URL<input className="input" type="url" placeholder="https://" value={sourceUrl} onChange={event=>setSourceUrl(event.target.value)}/></label>
      <label className="field">Link button label<input className="input" value={sourceLabel} onChange={event=>setSourceLabel(event.target.value)} maxLength={60}/></label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {onCancel && <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>}
        <button className="btn btn--primary" onClick={submit} disabled={busy || !body.trim()}>
          {busy ? 'Saving…' : initial?'Save headline':'Add headline'}
        </button>
      </div>
    </>
  )
}
