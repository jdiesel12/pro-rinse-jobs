import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { createJob, db, deleteProperty, fmtDate, fmtHours, migrateJob, money, patchProperty, SIDE_LABEL, sidesOf, type Job, type Photo, type Property } from '../lib/db'
import { back, go } from '../lib/nav'
import { Header, Thumb } from './common'
import { IKey, INav, INote, IPin, IPlus, ITrash, IUser } from './icons'

export function PropertyScreen({ id }: { id: string }) {
  const [prop, setProp] = useState<Property | null | undefined>(undefined)
  useEffect(() => { db.properties.get(id).then((p) => setProp(p ?? null)) }, [id])

  const jobs = useLiveQuery(
    async () => (await db.jobs.where('property_id').equals(id).filter((j) => !j.deleted).toArray())
      .sort((a, b) => b.job_date.localeCompare(a.job_date)),
    [id], [] as Job[],
  )
  const photosByJob = useLiveQuery(async () => {
    const ids = jobs.map((j) => j.id)
    const ps = ids.length ? await db.photos.where('job_id').anyOf(ids).filter((p) => !p.deleted).sortBy('created_at') : []
    const m = new Map<string, Photo[]>()
    for (const p of ps) m.set(p.job_id, [...(m.get(p.job_id) ?? []), p])
    return m
  }, [jobs], new Map<string, Photo[]>())

  if (prop === undefined) return <div className="screen"><Header title="" backBtn /></div>
  if (prop === null || prop.deleted) return <div className="screen"><Header title="" backBtn /><div className="empty">Property not found.</div></div>

  const set = (changes: Partial<Property>) => { setProp({ ...prop, ...changes }); void patchProperty(id, changes) }

  return (
    <div className="screen">
      <Header title="" backBtn />
      <div className="pad stack">
        <div className="prop-hero">
          <textarea className="addr-input" rows={1} defaultValue={prop.name ?? ''} placeholder="Name this property"
            onChange={(e) => set({ name: e.target.value })}
            onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }} />
          <label className="client-input">
            <IPin size={15} />
            <input defaultValue={prop.address} placeholder="Address" onChange={(e) => set({ address: e.target.value })} />
          </label>
          <label className="client-input">
            <IUser size={15} />
            <input defaultValue={prop.client} placeholder="Client or contractor" onChange={(e) => set({ client: e.target.value })} />
          </label>
          <div className="hero-actions">
            <button className="btn primary" onClick={async () => { const jid = await createJob(id); go('j/' + jid + '/new') }}>
              <IPlus size={18} strokeWidth={2.6} /> New job
            </button>
            {prop.address && (
              <a className="btn" href={`https://maps.apple.com/?q=${encodeURIComponent(prop.address)}`} target="_blank" rel="noreferrer">
                <INav size={16} /> Directions
              </a>
            )}
          </div>
        </div>

        <div className="card tinted-amber">
          <div className="card-title amber-text"><IKey size={16} /> Access</div>
          <textarea className="soft" rows={2} placeholder="Gate code, lockbox, dogs, where to park…" defaultValue={prop.access_notes}
            onChange={(e) => set({ access_notes: e.target.value })} />
        </div>

        <div className="card">
          <div className="card-title"><INote size={16} /> Property notes</div>
          <textarea className="soft" rows={3} placeholder="Window count, ladder spots, problem areas…" defaultValue={prop.notes}
            onChange={(e) => set({ notes: e.target.value })} />
        </div>

        <h2 className="section">History {jobs.length > 0 && <span className="count">{jobs.length}</span>}</h2>
        {jobs.length === 0 && <div className="empty">No jobs here yet.</div>}
        <div className="timeline">
          {jobs.map((j) => {
            const ps = photosByJob.get(j.id) ?? []
            const m = migrateJob(j)
            return (
              <button key={j.id} className="tl-item" onClick={() => go('j/' + j.id)}>
                <span className="tl-dot" />
                <div className="card tl-card">
                  <div className="tl-top">
                    <div className="title">{fmtDate(j.job_date)}</div>
                    <div className="tl-price">{money(j.price)}</div>
                  </div>
                  <div className="mini-tags">
                    {sidesOf(m.scope).map((sd) => (
                      <span key={sd} className={`tag-${sd}`}>{SIDE_LABEL[sd]}{m[`${sd}_minutes`] ? ` · ${fmtHours(m[`${sd}_minutes`])}` : ''}</span>
                    ))}
                  </div>
                  {sidesOf(m.scope).map((sd) => m[`${sd}_notes`] && (
                    <div key={sd} className="sub clamp">{m.scope === 'both' && <b>{SIDE_LABEL[sd]}: </b>}{m[`${sd}_notes`]}</div>
                  ))}
                  {ps.length > 0 && (
                    <div className="strip">
                      {ps.slice(0, 4).map((p) => <Thumb key={p.id} id={p.id} path={p.path} />)}
                      {ps.length > 4 && <span className="more">+{ps.length - 4}</span>}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <button className="text-danger" onClick={async () => {
          if (confirm(`Delete this property and all ${jobs.length} job(s)?`)) { await deleteProperty(id); back() }
        }}><ITrash size={16} /> Delete property</button>
      </div>
    </div>
  )
}
