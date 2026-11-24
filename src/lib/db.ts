import Dexie, { type Table } from 'dexie'

// Local-first store. The phone is the source of truth; Supabase is the backup.
// dirty=1 means "changed locally, not yet pushed". mtime = local edit stamp.

type SyncFields = { created_at: string; updated_at?: string; deleted: boolean; dirty: 0 | 1; mtime: string }

export type Property = SyncFields & {
  id: string
  address: string
  client: string
  access_notes: string
  notes: string
}

export type Job = SyncFields & {
  id: string
  property_id: string
  job_date: string // YYYY-MM-DD
  price: number | null
  services: string[]
  duration_min: number | null
  notes: string
}

export type PhotoKind = 'before' | 'after' | 'other'

export type Photo = SyncFields & {
  id: string
  job_id: string
  kind: PhotoKind
  path: string
}

export type BlobRow = { id: string; blob: Blob }
export type Meta = { key: string; value: string }

class AppDB extends Dexie {
  properties!: Table<Property, string>
  jobs!: Table<Job, string>
  photos!: Table<Photo, string>
  blobs!: Table<BlobRow, string>
  meta!: Table<Meta, string>
  constructor() {
    super('prorinse')
    this.version(1).stores({
      properties: 'id, dirty',
      jobs: 'id, property_id, job_date, dirty',
      photos: 'id, job_id, dirty',
      blobs: 'id',
      meta: 'key',
    })
  }
}

export const db = new AppDB()

export const nowIso = () => new Date().toISOString()
export const newId = () => crypto.randomUUID()
export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const SERVICES = [
  'Exterior',
  'Interior',
  'Screens',
  'Tracks',
  'Hard water',
  'Skylights',
  'Solar panels',
  'Gutters',
  'Post-construction',
]

export async function createProperty(address: string): Promise<string> {
  const id = newId()
  const t = nowIso()
  await db.properties.add({
    id, address: address.trim(), client: '', access_notes: '', notes: '',
    created_at: t, deleted: false, dirty: 1, mtime: t,
  })
  return id
}

export async function createJob(property_id: string): Promise<string> {
  const id = newId()
  const t = nowIso()
  // Pre-fill services from this property's most recent job.
  const prev = (await db.jobs.where('property_id').equals(property_id).toArray())
    .filter((j) => !j.deleted)
    .sort((a, b) => b.job_date.localeCompare(a.job_date))[0]
  await db.jobs.add({
    id, property_id, job_date: today(), price: null,
    services: prev ? [...prev.services] : [], duration_min: null, notes: '',
    created_at: t, deleted: false, dirty: 1, mtime: t,
  })
  return id
}

export async function patchProperty(id: string, changes: Partial<Property>) {
  await db.properties.update(id, { ...changes, dirty: 1, mtime: nowIso() })
}
export async function patchJob(id: string, changes: Partial<Job>) {
  await db.jobs.update(id, { ...changes, dirty: 1, mtime: nowIso() })
}

export async function addPhoto(job_id: string, kind: PhotoKind, blob: Blob, userId: string) {
  const id = newId()
  const t = nowIso()
  await db.transaction('rw', db.photos, db.blobs, async () => {
    await db.blobs.put({ id, blob })
    await db.photos.add({
      id, job_id, kind, path: `${userId}/${job_id}/${id}.jpg`,
      created_at: t, deleted: false, dirty: 1, mtime: t,
    })
  })
}

export async function deletePhoto(id: string) {
  await db.photos.update(id, { deleted: true, dirty: 1, mtime: nowIso() })
}

export async function deleteJob(id: string) {
  const t = nowIso()
  await db.transaction('rw', db.jobs, db.photos, async () => {
    await db.jobs.update(id, { deleted: true, dirty: 1, mtime: t })
    await db.photos.where('job_id').equals(id).modify({ deleted: true, dirty: 1, mtime: t })
  })
}

export async function deleteProperty(id: string) {
  const t = nowIso()
  const jobs = await db.jobs.where('property_id').equals(id).toArray()
  for (const j of jobs) await deleteJob(j.id)
  await db.properties.update(id, { deleted: true, dirty: 1, mtime: t })
}

export function money(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: n % 1 ? 2 : 0 })
}

export function fmtDate(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
