import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addPhoto, db, deleteJob, deletePhoto, fmtDate, money, patchJob, SERVICES,
  type Job, type Photo, type PhotoKind,
} from '../lib/db'
import { compressImage } from '../lib/image'
import { back, go } from '../lib/nav'
import { Header, Thumb } from './common'
import { ICalendar, ICamera, ICheck, IChevron, IClock, IHistory, IImage, IKey, INote, IPin, ITag, ITrash, IX } from './icons'

const KINDS: PhotoKind[] = ['before', 'after', 'other']
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

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
        await addPhoto(id, kind, await compressImage(f), owner)
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

  const toggleService = (s: string) => {
    const cur = (latest.current ?? job).services
    set({ services: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] })
  }

  const hours = job.duration_min == null ? '' : String(+(job.duration_min / 60).toFixed(2))
  const counts = Object.fromEntries(KINDS.map((k) => [k, photos.filter((p) => p.kind === k).length]))

  return (
    <div className="screen">
      <Header title={isNew ? 'New job' : fmtDate(job.job_date)} backBtn right={<button className="btn primary pill-btn" onClick={done}>Done</button>} />
      <div className="pad stack">
        <button className="card prop-card" onClick={() => go('p/' + job.property_id)}>
          <span className="tile blue"><IPin size={20} /></span>
          <div className="grow">
            <div className="title">{property?.address || 'No address'}</div>
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
          <div className="split">
            <label className="mini-field">
              <span className="label"><ICalendar size={13} /> Date</span>
              <input type="date" value={job.job_date} onChange={(e) => e.target.value && set({ job_date: e.target.value })} />
            </label>
            <label className="mini-field">
              <span className="label"><IClock size={13} /> Hours</span>
              <input type="text" inputMode="decimal" placeholder="—" defaultValue={hours}
                onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); set({ duration_min: v === '' ? null : Math.round(Number(v) * 60) }) }} />
            </label>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><ITag size={16} /> Services</div>
          <div className="chips">
            {SERVICES.map((s) => {
              const on = job.services.includes(s)
              return (
                <button key={s} className={`chip ${on ? 'on' : ''}`} onClick={() => toggleService(s)}>
                  {on && <ICheck size={14} strokeWidth={3} />}{s}
                </button>
              )
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            <ICamera size={16} /> Photos
            {busy > 0 && <span className="saving">Saving {busy}…</span>}
          </div>
          <div className="seg">
            {KINDS.map((k) => (
              <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
                {cap(k)}{counts[k] > 0 && <small>{counts[k]}</small>}
              </button>
            ))}
          </div>
          <div className="photo-actions">
            <button className="action" onClick={() => camRef.current?.click()}><ICamera size={22} /><span>Take {kind} photo</span></button>
            <button className="action" onClick={() => libRef.current?.click()}><IImage size={22} /><span>From library</span></button>
          </div>
          <input ref={camRef} hidden type="file" accept="image/*" capture="environment" onChange={(e) => { void onFiles(e.target.files); e.target.value = '' }} />
          <input ref={libRef} hidden type="file" accept="image/*" multiple onChange={(e) => { void onFiles(e.target.files); e.target.value = '' }} />
          {photos.length > 0 && (
            <div className="grid">
              {photos.map((p) => <Thumb key={p.id} id={p.id} path={p.path} label={p.kind} onClick={() => setViewer(p)} />)}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title"><INote size={16} /> Notes</div>
          <textarea className="soft" rows={4} placeholder="Problem windows, extras, anything worth remembering…" defaultValue={job.notes}
            onChange={(e) => set({ notes: e.target.value })} />
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
            <div className="seg dark">
              {KINDS.map((k) => (
                <button key={k} className={viewer.kind === k ? 'on' : ''} onClick={async () => {
                  await db.photos.update(viewer.id, { kind: k, dirty: 1, mtime: new Date().toISOString() })
                  setViewer({ ...viewer, kind: k })
                }}>{cap(k)}</button>
              ))}
            </div>
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
