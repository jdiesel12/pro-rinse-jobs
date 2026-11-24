import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addPhoto, db, deleteJob, deletePhoto, fmtDate, money, patchJob, SERVICES,
  type Job, type Photo, type PhotoKind,
} from '../lib/db'
import { compressImage } from '../lib/image'
import { back, go } from '../lib/nav'
import { Header, Thumb } from './common'

export function JobScreen({ id, owner }: { id: string; owner: string }) {
  const [job, setJob] = useState<Job | null | undefined>(undefined)
  const isNew = location.hash.endsWith('/new')

  // Load once; after that local state is the editor and every change autosaves.
  useEffect(() => { db.jobs.get(id).then((j) => setJob(j ?? null)) }, [id])

  const property = useLiveQuery(() => (job ? db.properties.get(job.property_id) : undefined), [job?.property_id])
  const photos = useLiveQuery(
    () => db.photos.where('job_id').equals(id).filter((p) => !p.deleted).sortBy('created_at'),
    [id], [] as Photo[],
  )
  const prevJob = useLiveQuery(async () => {
    if (!job) return undefined
    const js = await db.jobs.where('property_id').equals(job.property_id).filter((j) => !j.deleted && j.id !== id && j.job_date <= job.job_date).toArray()
    return js.sort((a, b) => b.job_date.localeCompare(a.job_date))[0]
  }, [job?.property_id, job?.job_date, id])

  const [kind, setKind] = useState<PhotoKind>('before')
  const [busy, setBusy] = useState(0)
  const [viewer, setViewer] = useState<Photo | null>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const libRef = useRef<HTMLInputElement>(null)

  if (job === undefined) return <div className="screen"><Header title="Job" backBtn /></div>
  if (job === null || job.deleted) return <div className="screen"><Header title="Job" backBtn /><div className="empty">Job not found.</div></div>

  const set = (changes: Partial<Job>) => {
    setJob({ ...job, ...changes })
    void patchJob(id, changes)
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy((b) => b + files.length)
    for (const f of Array.from(files)) {
      try {
        const blob = await compressImage(f)
        await addPhoto(id, kind, blob, owner)
      } catch (e) {
        alert('Could not read that photo: ' + (e instanceof Error ? e.message : e))
      } finally {
        setBusy((b) => b - 1)
      }
    }
  }

  async function done() {
    // Throw away a brand-new job you backed out of without entering anything.
    const empty = job && job.price == null && !job.notes && photos.length === 0
    if (isNew && empty && !confirm('Nothing entered yet. Discard this job?')) return
    if (isNew && empty) await deleteJob(id)
    back()
  }

  const toggleService = (s: string) =>
    set({ services: job.services.includes(s) ? job.services.filter((x) => x !== s) : [...job.services, s] })

  const hours = job.duration_min == null ? '' : String(+(job.duration_min / 60).toFixed(2))

  return (
    <div className="screen">
      <Header title={isNew ? 'New job' : 'Job'} right={<button className="btn primary sm" onClick={done}>Done</button>} />
      <div className="pad stack">
        <button className="card prop-link" onClick={() => go('p/' + job.property_id)}>
          <div className="grow">
            <div className="title">{property?.address || '(no address)'}</div>
            {property?.access_notes && <div className="sub access">🔑 {property.access_notes}</div>}
            {prevJob && <div className="sub">Last time: {fmtDate(prevJob.job_date)} · {money(prevJob.price)}</div>}
          </div>
          <span className="chev">›</span>
        </button>

        <div className="card form">
          <label>Date<input type="date" value={job.job_date} onChange={(e) => e.target.value && set({ job_date: e.target.value })} /></label>
          <label>Price billed
            <div className="money-input">
              <span>$</span>
              <input
                type="text" inputMode="decimal" placeholder="0"
                defaultValue={job.price ?? ''}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, '')
                  set({ price: v === '' ? null : Number(v) })
                }}
              />
            </div>
          </label>
          <label>Hours on site<input type="text" inputMode="decimal" placeholder="optional" defaultValue={hours}
            onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); set({ duration_min: v === '' ? null : Math.round(Number(v) * 60) }) }} /></label>
          <label className="toggle">
            <span>Paid</span>
            <input type="checkbox" checked={job.paid} onChange={(e) => set({ paid: e.target.checked })} />
          </label>
        </div>

        <div className="card">
          <div className="card-title">Services</div>
          <div className="chips">
            {SERVICES.map((s) => (
              <button key={s} className={`chip ${job.services.includes(s) ? 'on' : ''}`} onClick={() => toggleService(s)}>{s}</button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Photos {busy > 0 && <span className="muted">· saving {busy}…</span>}</div>
          <div className="seg">
            {(['before', 'after', 'other'] as PhotoKind[]).map((k) => (
              <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{k[0].toUpperCase() + k.slice(1)}</button>
            ))}
          </div>
          <div className="row-btns">
            <button className="btn big" onClick={() => camRef.current?.click()}>📷 Camera</button>
            <button className="btn big" onClick={() => libRef.current?.click()}>🖼️ Library</button>
          </div>
          <input ref={camRef} hidden type="file" accept="image/*" capture="environment" onChange={(e) => { void onFiles(e.target.files); e.target.value = '' }} />
          <input ref={libRef} hidden type="file" accept="image/*" multiple onChange={(e) => { void onFiles(e.target.files); e.target.value = '' }} />
          {photos.length > 0 && (
            <div className="grid">
              {photos.map((p) => <Thumb key={p.id} id={p.id} path={p.path} label={p.kind} onClick={() => setViewer(p)} />)}
            </div>
          )}
        </div>

        <div className="card form">
          <label>Notes
            <textarea rows={4} placeholder="Anything worth remembering: problem windows, extras, upsell ideas…" defaultValue={job.notes}
              onChange={(e) => set({ notes: e.target.value })} />
          </label>
        </div>

        <button className="btn danger" onClick={async () => { if (confirm('Delete this job and its photos?')) { await deleteJob(id); back() } }}>Delete job</button>
      </div>

      {viewer && (
        <div className="viewer" onClick={() => setViewer(null)}>
          <FullImage id={viewer.id} />
          <div className="viewer-bar" onClick={(e) => e.stopPropagation()}>
            <select value={viewer.kind} onChange={async (e) => {
              const k = e.target.value as PhotoKind
              await db.photos.update(viewer.id, { kind: k, dirty: 1, mtime: new Date().toISOString() })
              setViewer({ ...viewer, kind: k })
            }}>
              <option value="before">Before</option><option value="after">After</option><option value="other">Other</option>
            </select>
            <button className="btn danger sm" onClick={async () => { if (confirm('Delete photo?')) { await deletePhoto(viewer.id); setViewer(null) } }}>Delete</button>
            <button className="btn sm" onClick={() => setViewer(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

function FullImage({ id }: { id: string }) {
  const row = useLiveQuery(() => db.blobs.get(id), [id])
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!row) return
    const u = URL.createObjectURL(row.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [row])
  return url ? <img src={url} alt="" /> : <div className="muted">Loading…</div>
}
