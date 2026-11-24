import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { createJob, db, deleteProperty, fmtDate, money, patchProperty, type Job, type Photo, type Property } from '../lib/db'
import { back, go } from '../lib/nav'
import { Header, Thumb } from './common'

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
    const ps = ids.length ? await db.photos.where('job_id').anyOf(ids).filter((p) => !p.deleted).toArray() : []
    const m = new Map<string, Photo[]>()
    for (const p of ps) m.set(p.job_id, [...(m.get(p.job_id) ?? []), p])
    return m
  }, [jobs], new Map<string, Photo[]>())

  if (prop === undefined) return <div className="screen"><Header title="Property" backBtn /></div>
  if (prop === null || prop.deleted) return <div className="screen"><Header title="Property" backBtn /><div className="empty">Property not found.</div></div>

  const set = (changes: Partial<Property>) => { setProp({ ...prop, ...changes }); void patchProperty(id, changes) }

  return (
    <div className="screen">
      <Header title="Property" backBtn />
      <div className="pad stack">
        <div className="card form">
          <label>Address<input defaultValue={prop.address} placeholder="123 Main St, Lehi" onChange={(e) => set({ address: e.target.value })} /></label>
          {prop.address && (
            <a className="maplink" href={`https://maps.apple.com/?q=${encodeURIComponent(prop.address)}`} target="_blank" rel="noreferrer">📍 Open in Maps</a>
          )}
          <label>Client / contractor<input defaultValue={prop.client} placeholder="Homeowner name or contractor" onChange={(e) => set({ client: e.target.value })} /></label>
          <label>Access (gate codes, lockbox, dogs)<textarea rows={2} defaultValue={prop.access_notes} onChange={(e) => set({ access_notes: e.target.value })} /></label>
          <label>Property notes (window count, ladders, problem spots)<textarea rows={4} defaultValue={prop.notes} onChange={(e) => set({ notes: e.target.value })} /></label>
        </div>

        <button className="btn primary big" onClick={async () => { const jid = await createJob(id); go('j/' + jid + '/new') }}>＋ New job here</button>

        <h2 className="section">Job history</h2>
        {jobs.length === 0 && <div className="empty">No jobs yet.</div>}
        {jobs.map((j) => {
          const ps = photosByJob.get(j.id) ?? []
          return (
            <button key={j.id} className="card job-card" onClick={() => go('j/' + j.id)}>
              <div className="job-top">
                <div>
                  <div className="title">{fmtDate(j.job_date)}</div>
                  <div className="sub">{j.services.join(', ') || 'No services tagged'}{j.duration_min ? ` · ${+(j.duration_min / 60).toFixed(1)}h` : ''}</div>
                </div>
                <div className="price">{money(j.price)}</div>
              </div>
              {j.notes && <div className="sub clamp">{j.notes}</div>}
              {ps.length > 0 && (
                <div className="strip">
                  {ps.slice(0, 5).map((p) => <Thumb key={p.id} id={p.id} path={p.path} />)}
                  {ps.length > 5 && <span className="more">+{ps.length - 5}</span>}
                </div>
              )}
            </button>
          )
        })}

        <button className="btn danger" onClick={async () => {
          if (confirm(`Delete this property and all ${jobs.length} job(s)?`)) { await deleteProperty(id); back() }
        }}>Delete property</button>
      </div>
    </div>
  )
}
