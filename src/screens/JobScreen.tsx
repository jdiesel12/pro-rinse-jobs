import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addPhoto, db, deleteJob, deletePhoto, fmtDate, fmtHours, migrateJob, money, patchJob, propSubtitle, propTitle,
  SCOPES, SIDE_LABEL, sidesOf, type Job, type Photo, type Side,
} from '../lib/db'
import { compressImage } from '../lib/image'
import { back, go } from '../lib/nav'
import { Header, Thumb } from './common'
import { ICalendar, ICamera, IChevron, IClock, IHistory, IImage, IKey, IPin, ITrash, IX } from './icons'


export function JobScreen({ id, owner }: { id: string; owner: string }) {
  const [job, setJob] = useState<Job | null | undefined>(undefined)
  const isNew = location.hash.endsWith('/new')

  // Load once; after that local state is the editor and every change autosaves.
  useEffect(() => { db.jobs.get(id).then((j) => setJob(j ? migrateJob(j) : null)) }, [id])

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

  const [busy, setBusy] = useState(0)
  const [viewer, setViewer] = useState<Photo | null>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const libRef = useRef<HTMLInputElement>(null)
  const latest = useRef<Job | null>(null) // newest edits, so rapid taps don't clobber each other

  if (job === undefined) return <div className="screen"><Header title="Job" backBtn /></div>
  if (job === null || job.deleted) return <div className="screen"><Header title="Job" backBtn /><div className="empty">Job not found.</div></div>

  const set = (changes: Partial<Job>) => {
    latest.current = { ...(latest.current ?? job), ...changes }
    setJob(latest.current)
    void patchJob(id, changes)
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy((b) => b + files.length)
    for (const f of Array.from(files)) {
      try {
        await addPhoto(id, 'other', await compressImage(f), owner)
      } catch (e) {
        alert('Could not read that photo: ' + (e instanceof Error ? e.message : e))
      } finally {
        setBusy((b) => b - 1)
      }
    }
  }

  async function done() {
    // Throw away a brand-new job you backed out of without entering anything.
    const empty = job && job.price == null && !job.ext_notes && !job.int_notes && !job.ext_minutes && !job.int_minutes && photos.length === 0
    if (isNew && empty && !confirm('Nothing entered yet. Discard this job?')) return
    if (isNew && empty) await deleteJob(id)
    back()
  }


  // Hours per side; the job total is kept in duration_min.
  const setMinutes = (side: Side, min: number | null) => {
    const cur = latest.current ?? job
    const ext = side === 'ext' ? min : cur.ext_minutes
    const int = side === 'int' ? min : cur.int_minutes
    const total = (ext ?? 0) + (int ?? 0)
    set({ [`${side}_minutes`]: min, duration_min: total || null } as Partial<Job>)
  }
  const sides = sidesOf(job.scope)
  const total = sides.reduce((s, sd) => s + (job[`${sd}_minutes`] ?? 0), 0)

  return (
    <div className="screen">
      <Header title={isNew ? 'New job' : fmtDate(job.job_date)} backBtn right={<button className="btn primary pill-btn" onClick={done}>Done</button>} />
      <div className="pad stack">
        <button className="card prop-card" onClick={() => go('p/' + job.property_id)}>
          <span className="tile blue"><IPin size={20} /></span>
          <div className="grow">
            <div className="title">{propTitle(property)}</div>
            {propSubtitle(property) && <div className="sub addr-line">{propSubtitle(property)}</div>}
            {prevJob
              ? <div className="sub"><IHistory size={13} className="inline-ic" /> Last visit {fmtDate(prevJob.job_date)} · {money(prevJob.price)}</div>
              : <div className="sub">First visit</div>}
          </div>
          <IChevron size={18} className="chev" />
        </button>

        {property?.access_notes && (
          <div className="callout amber"><IKey size={16} /><span>{property.access_notes}</span></div>
        )}

        <div className="card price-card">
          <div className="label">Price</div>
          <div className="price-input">
            <span>$</span>
            <input type="text" inputMode="decimal" placeholder="0" defaultValue={job.price ?? ''}
              onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); set({ price: v === '' ? null : Number(v) }) }} />
          </div>
          <div className="split one">
            <label className="mini-field">
              <span className="label"><ICalendar size={13} /> Date</span>
              <input type="date" value={job.job_date} onChange={(e) => e.target.value && set({ job_date: e.target.value })} />
            </label>
          </div>
        </div>

        <div className="card">
          <div className="seg scope-seg">
            {SCOPES.map((s) => (
              <button key={s.key} className={job.scope === s.key ? 'on' : ''} onClick={() => set({ scope: s.key })}>{s.label}</button>
            ))}
          </div>
          {sides.map((sd) => (
            <div key={sd} className={`side side-${sd}`}>
              {sides.length > 1 && <div className="side-head">{SIDE_LABEL[sd]}</div>}
              <label className="side-hours">
                <IClock size={16} />
                <span>Hours</span>
                <input type="text" inputMode="decimal" placeholder="—"
                  defaultValue={job[`${sd}_minutes`] == null ? '' : String(+(job[`${sd}_minutes`]! / 60).toFixed(2))}
                  onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); setMinutes(sd, v === '' ? null : Math.round(Number(v) * 60)) }} />
              </label>
              <textarea className="soft" rows={3}
                placeholder={sd === 'ext' ? 'Exterior notes: ladders, hard water, screens…' : 'Interior notes: rooms, furniture, sills…'}
                defaultValue={job[`${sd}_notes`]}
                onChange={(e) => set({ [`${sd}_notes`]: e.target.value } as Partial<Job>)} />
            </div>
          ))}
          {sides.length > 1 && total > 0 && <div className="side-total"><span>Total time</span><b>{fmtHours(total)}</b></div>}
        </div>


        <div className="card">
          <div className="card-title">
            <ICamera size={16} /> Photos
            {photos.length > 0 && <span className="count">{photos.length}</span>}
            {busy > 0 && <span className="saving">Saving {busy}…</span>}
          </div>
          <div className="photo-actions">
            <button className="action" onClick={() => camRef.current?.click()}><ICamera size={22} /><span>Take photo</span></button>
            <button className="action" onClick={() => libRef.current?.click()}><IImage size={22} /><span>From library</span></button>
          </div>
          <input ref={camRef} hidden type="file" accept="image/*" capture="environment" onChange={(e) => { void onFiles(e.target.files); e.target.value = '' }} />
          <input ref={libRef} hidden type="file" accept="image/*" multiple onChange={(e) => { void onFiles(e.target.files); e.target.value = '' }} />
          {photos.length > 0 && (
            <div className="grid">
              {photos.map((p) => <Thumb key={p.id} id={p.id} path={p.path} onClick={() => setViewer(p)} />)}
            </div>
          )}
        </div>

        <button className="text-danger" onClick={async () => { if (confirm('Delete this job and its photos?')) { await deleteJob(id); back() } }}>
          <ITrash size={16} /> Delete job
        </button>
      </div>

      {viewer && (
        <div className="viewer">
          <button className="viewer-close" aria-label="Close" onClick={() => setViewer(null)}><IX size={22} /></button>
          <FullImage id={viewer.id} />
          <div className="viewer-bar">
            <span className="grow" />
            <button className="icon-btn danger" aria-label="Delete photo" onClick={async () => { if (confirm('Delete photo?')) { await deletePhoto(viewer.id); setViewer(null) } }}>
              <ITrash size={20} />
            </button>
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
