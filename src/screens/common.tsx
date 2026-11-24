import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Job, type Photo, type Property } from '../lib/db'
import { fetchMissingPhoto, sync, usePendingCount, useSyncStatus } from '../lib/sync'
import { back, go } from '../lib/nav'
import { IBack, ICheck, ICloud, ICloudOff, IHome, IPlus, IRefresh } from './icons'

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(navigator.onLine)
    window.addEventListener('online', on); window.addEventListener('offline', on)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on) }
  }, [])
  return online
}

export function SyncBadge({ glass }: { glass?: boolean }) {
  const s = useSyncStatus()
  const pending = usePendingCount()
  const online = useOnline()
  let cls = 'ok', text = 'Synced', icon = <ICheck size={14} strokeWidth={2.6} />
  if (s.state === 'syncing') { cls = 'busy'; text = 'Syncing'; icon = <IRefresh size={14} className="spin" /> }
  else if (!online) { cls = pending ? 'warn' : 'off'; text = pending ? `${pending} offline` : 'Offline'; icon = <ICloudOff size={14} /> }
  else if (s.state === 'error' || s.state === 'signedout') { cls = 'err'; text = 'Sync issue'; icon = <ICloud size={14} /> }
  else if (pending) { cls = 'warn'; text = `${pending} waiting`; icon = <ICloud size={14} /> }
  return (
    <button className={`badge ${cls} ${glass ? 'glass' : ''}`} onClick={() => { void sync(); go('backup') }}>
      {icon}<span>{text}</span>
    </button>
  )
}

export function Header({ title, backBtn, right }: { title: string; backBtn?: boolean; right?: ReactNode }) {
  return (
    <header className="hdr">
      <div>{backBtn && <button className="icon-btn" aria-label="Back" onClick={back}><IBack size={22} /></button>}</div>
      <h1>{title}</h1>
      <div className="hdr-right">{right ?? <SyncBadge />}</div>
    </header>
  )
}

export function AddButton() {
  return (
    <button className="fab" aria-label="New job" onClick={() => go('new')}>
      <IPlus size={22} strokeWidth={2.6} /><span>New job</span>
    </button>
  )
}

function useBlobUrl(id: string | undefined, path: string | undefined) {
  const row = useLiveQuery(() => (id ? db.blobs.get(id) : undefined), [id])
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!id || !path) { setUrl(undefined); return }
    if (row === undefined) { fetchMissingPhoto(id, path); return }
    const u = URL.createObjectURL(row.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [row, id, path])
  return url
}

export function Thumb({ id, path, onClick, label }: { id: string; path: string; onClick?: () => void; label?: string }) {
  const url = useBlobUrl(id, path)
  return (
    <button className="thumb" onClick={onClick} type="button">
      {url ? <img src={url} alt="" /> : <span className="thumb-ph" />}
      {label && <span className={`thumb-label k-${label}`}>{label}</span>}
    </button>
  )
}

/** A cover image (or a placeholder icon tile). */
export function Cover({ photo, className = '' }: { photo?: Photo; className?: string }) {
  const url = useBlobUrl(photo?.id, photo?.path)
  return (
    <div className={`cover ${className}`}>
      {url ? <img src={url} alt="" /> : <IHome size={22} />}
    </div>
  )
}

/** Best photo per job: prefer an "after" shot, else the first one. */
export function useCoverPhotos(jobIds: string[]) {
  const key = jobIds.join(',')
  return useLiveQuery(async () => {
    const m = new Map<string, Photo>()
    const ids = key ? key.split(',') : []
    if (!ids.length) return m
    const ps = await db.photos.where('job_id').anyOf(ids).filter((p) => !p.deleted).sortBy('created_at')
    for (const p of ps) {
      const cur = m.get(p.job_id)
      if (!cur || (cur.kind !== 'after' && p.kind === 'after')) m.set(p.job_id, p)
    }
    return m
  }, [key], new Map<string, Photo>())
}

export function useAllData() {
  const properties = useLiveQuery(() => db.properties.filter((p) => !p.deleted).toArray(), [], [] as Property[])
  const jobs = useLiveQuery(() => db.jobs.filter((j) => !j.deleted).toArray(), [], [] as Job[])
  return { properties, jobs }
}

export function relDate(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  const date = new Date(y, m - 1, day)
  const t = new Date(); t.setHours(0, 0, 0, 0)
  const days = Math.round((t.getTime() - date.getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days > 1 && days < 7) return `${days} days ago`
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', ...(date.getFullYear() !== t.getFullYear() ? { year: 'numeric' as const } : {}),
  })
}
