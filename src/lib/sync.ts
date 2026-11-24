import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { liveQuery, type Table } from 'dexie'
import { supabase, BUCKET } from './supabase'
import { db } from './db'

// ---- status store ---------------------------------------------------------
export type SyncStatus = { state: 'idle' | 'syncing' | 'error' | 'offline' | 'signedout'; error: string; lastSync: string }
let status: SyncStatus = { state: 'idle', error: '', lastSync: localStorage.getItem('lastSync') || '' }
const listeners = new Set<(s: SyncStatus) => void>()
function setStatus(p: Partial<SyncStatus>) {
  status = { ...status, ...p }
  listeners.forEach((l) => l(status))
}
export function useSyncStatus() {
  const [s, set] = useState(status)
  useEffect(() => { listeners.add(set); return () => { listeners.delete(set) } }, [])
  return s
}
export function usePendingCount() {
  return useLiveQuery(async () => {
    const [a, b, c] = await Promise.all([
      db.properties.where('dirty').equals(1).count(),
      db.jobs.where('dirty').equals(1).count(),
      db.photos.where('dirty').equals(1).count(),
    ])
    return a + b + c
  }, [], 0)
}

// ---- scheduling ------------------------------------------------------------
let running: Promise<void> | null = null
let again = false
let timer: ReturnType<typeof setTimeout> | undefined

export function sync(): Promise<void> {
  if (running) { again = true; return running }
  running = (async () => {
    do { again = false; await doSync() } while (again)
  })().finally(() => { running = null })
  return running
}

export function scheduleSync(ms = 2500) {
  clearTimeout(timer)
  timer = setTimeout(() => { void sync() }, ms)
}

export function startAutoSync() {
  void sync()
  const onOnline = () => void sync()
  const onVis = () => { if (document.visibilityState === 'visible') void sync() }
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVis)
  const iv = setInterval(() => void sync(), 60_000)
  // Push shortly after any local edit.
  const sub = liveQuery(() => Promise.all([
    db.properties.where('dirty').equals(1).primaryKeys(),
    db.jobs.where('dirty').equals(1).primaryKeys(),
    db.photos.where('dirty').equals(1).primaryKeys(),
  ])).subscribe((r) => { if (r.some((x) => x.length)) scheduleSync() })
  return () => {
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVis)
    clearInterval(iv)
    sub.unsubscribe()
  }
}

// ---- core --------------------------------------------------------------------
type Row = { id: string; dirty: 0 | 1; mtime: string; updated_at?: string; [k: string]: unknown }

function toServer(r: Row) {
  const { dirty: _d, mtime: _m, updated_at: _u, ...rest } = r
  void _d; void _m; void _u
  return rest
}

async function doSync() {
  if (!navigator.onLine) { setStatus({ state: 'offline', error: '' }); return }
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (!session) { setStatus({ state: 'signedout', error: 'Sign in again to back up your data' }); return }
  setStatus({ state: 'syncing', error: '' })
  try {
    await pushTable('properties', db.properties as unknown as Table<Row, string>)
    await pushTable('jobs', db.jobs as unknown as Table<Row, string>)
    await pushPhotos()
    await pullTable('properties', db.properties as unknown as Table<Row, string>)
    await pullTable('jobs', db.jobs as unknown as Table<Row, string>)
    await pullTable('photos', db.photos as unknown as Table<Row, string>)
    const t = new Date().toISOString()
    localStorage.setItem('lastSync', t)
    setStatus({ state: 'idle', error: '', lastSync: t })
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e as { message?: string })?.message || String(e)
    setStatus({ state: navigator.onLine ? 'error' : 'offline', error: navigator.onLine ? msg : '' })
  }
}

async function markClean(table: Table<Row, string>, rows: Row[]) {
  await table.db.transaction('rw', table, async () => {
    for (const r of rows) {
      const cur = await table.get(r.id)
      // Only clear the flag if nothing changed while we were uploading.
      if (cur && cur.mtime === r.mtime) await table.update(r.id, { dirty: 0 } as never)
    }
  })
}

async function pushTable(name: string, table: Table<Row, string>) {
  const rows = await table.where('dirty').equals(1).toArray()
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200)
    const { error } = await supabase.from(name).upsert(batch.map(toServer))
    if (error) throw error
    await markClean(table, batch)
  }
}

async function pushPhotos() {
  const rows = (await db.photos.where('dirty').equals(1).toArray()) as unknown as Row[]
  for (const r of rows) {
    if (!r.deleted) {
      const b = await db.blobs.get(r.id)
      if (b) {
        const { error } = await supabase.storage.from(BUCKET).upload(r.path as string, b.blob, {
          contentType: 'image/jpeg', upsert: true, cacheControl: '31536000',
        })
        if (error) throw error
      }
    } else {
      await supabase.storage.from(BUCKET).remove([r.path as string])
    }
    const { error } = await supabase.from('photos').upsert(toServer(r))
    if (error) throw error
    await markClean(db.photos as unknown as Table<Row, string>, [r])
  }
}

async function pullTable(name: string, table: Table<Row, string>) {
  const key = 'pulled_' + name
  let since = (await db.meta.get(key))?.value || '1970-01-01T00:00:00Z'
  for (;;) {
    const { data, error } = await supabase.from(name).select('*').gt('updated_at', since).order('updated_at').limit(500)
    if (error) throw error
    if (!data || !data.length) break
    await db.transaction('rw', table, db.meta, async () => {
      for (const raw of data as Record<string, unknown>[]) {
        const local = await table.get(raw.id as string)
        if (local?.dirty) continue // local edit wins; it'll be pushed next round
        const { user_id: _uid, ...r } = raw
        void _uid
        if ('price' in r) r.price = r.price == null ? null : Number(r.price)
        await table.put({ ...(r as Row), dirty: 0, mtime: r.updated_at as string })
      }
      since = data[data.length - 1].updated_at as string
      await db.meta.put({ key, value: since })
    })
    if (data.length < 500) break
  }
}

// Fetch a photo that exists in the cloud but not on this device (e.g. new phone).
const inflight = new Map<string, Promise<void>>()
export function fetchMissingPhoto(id: string, path: string) {
  if (inflight.has(id) || !navigator.onLine) return
  const p = (async () => {
    const { data, error } = await supabase.storage.from(BUCKET).download(path)
    if (!error && data) await db.blobs.put({ id, blob: data })
  })().finally(() => inflight.delete(id))
  inflight.set(id, p)
}
