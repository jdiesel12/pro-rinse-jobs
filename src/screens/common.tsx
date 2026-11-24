import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Job, type Property } from '../lib/db'
import { fetchMissingPhoto, sync, usePendingCount, useSyncStatus } from '../lib/sync'
import { back, go } from '../lib/nav'

export function SyncBadge() {
  const s = useSyncStatus()
  const pending = usePendingCount()
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(navigator.onLine)
    window.addEventListener('online', on); window.addEventListener('offline', on)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on) }
  }, [])
  let cls = 'ok', text = 'Backed up'
  if (s.state === 'syncing') { cls = 'busy'; text = 'Syncing…' }
  else if (!online) { cls = pending ? 'warn' : 'off'; text = pending ? `Offline · ${pending} waiting` : 'Offline' }
  else if (s.state === 'error' || s.state === 'signedout') { cls = 'err'; text = pending ? `Sync error · ${pending} waiting` : 'Sync error' }
  else if (pending) { cls = 'warn'; text = `${pending} waiting` }
  return (
    <button className={`badge ${cls}`} onClick={() => { void sync(); if (s.error) alert(s.error) }}>
      <span className="dot" />{text}
    </button>
  )
}

export function Header({ title, backBtn, right }: { title: string; backBtn?: boolean; right?: ReactNode }) {
  return (
    <header className="hdr">
      {backBtn ? <button className="hdr-back" onClick={back}>‹ Back</button> : <span />}
      <h1>{title}</h1>
      <div className="hdr-right">{right ?? <SyncBadge />}</div>
    </header>
  )
}

export function TabBar({ active }: { active: 'home' | 'reports' }) {
  return (
    <nav className="tabs">
      <button className={active === 'home' ? 'on' : ''} onClick={() => go('')}>🏠<span>Jobs</span></button>
      <button className="add" onClick={() => go('new')}>＋</button>
      <button className={active === 'reports' ? 'on' : ''} onClick={() => go('reports')}>📊<span>Totals</span></button>
    </nav>
  )
}

export function Thumb({ id, path, onClick, label }: { id: string; path: string; onClick?: () => void; label?: string }) {
  const row = useLiveQuery(() => db.blobs.get(id), [id])
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (row === undefined) { fetchMissingPhoto(id, path); return }
    const u = URL.createObjectURL(row.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [row, id, path])
  return (
    <button className="thumb" onClick={onClick}>
      {url ? <img src={url} alt="" /> : <span className="muted small">☁︎</span>}
      {label && <span className="thumb-label">{label}</span>}
    </button>
  )
}

export function useAllData() {
  const properties = useLiveQuery(() => db.properties.filter((p) => !p.deleted).toArray(), [], [] as Property[])
  const jobs = useLiveQuery(() => db.jobs.filter((j) => !j.deleted).toArray(), [], [] as Job[])
  return { properties, jobs }
}

export function csvEscape(v: unknown) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
