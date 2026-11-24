import { useMemo, useState } from 'react'
import { money } from '../lib/db'
import { supabase } from '../lib/supabase'
import { sync, usePendingCount, useSyncStatus } from '../lib/sync'
import { csvEscape, Header, TabBar, useAllData } from './common'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function Reports() {
  const { properties, jobs } = useAllData()
  const status = useSyncStatus()
  const pending = usePendingCount()
  const years = useMemo(() => {
    const ys = new Set(jobs.map((j) => j.job_date.slice(0, 4)))
    ys.add(String(new Date().getFullYear()))
    return [...ys].sort().reverse()
  }, [jobs])
  const [year, setYear] = useState(String(new Date().getFullYear()))

  const yearJobs = jobs.filter((j) => j.job_date.startsWith(year))
  const months = MONTHS.map((name, i) => {
    const js = yearJobs.filter((j) => Number(j.job_date.slice(5, 7)) === i + 1)
    return { name, count: js.length, total: js.reduce((s, j) => s + (j.price ?? 0), 0) }
  })
  const total = yearJobs.reduce((s, j) => s + (j.price ?? 0), 0)
  const unpaid = yearJobs.filter((j) => !j.paid).reduce((s, j) => s + (j.price ?? 0), 0)
  const max = Math.max(1, ...months.map((m) => m.total))

  async function exportCsv() {
    const addr = new Map(properties.map((p) => [p.id, p]))
    const rows = [['Date', 'Address', 'Client', 'Price', 'Paid', 'Hours', 'Services', 'Notes']]
    for (const j of [...yearJobs].sort((a, b) => a.job_date.localeCompare(b.job_date))) {
      const p = addr.get(j.property_id)
      rows.push([j.job_date, p?.address ?? '', p?.client ?? '', j.price == null ? '' : String(j.price), j.paid ? 'yes' : 'no',
        j.duration_min == null ? '' : (j.duration_min / 60).toFixed(2), j.services.join('; '), j.notes])
    }
    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n')
    const file = new File([csv], `pro-rinse-jobs-${year}.csv`, { type: 'text/csv' })
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: file.name }) } catch { /* cancelled */ }
    } else {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(file); a.download = file.name; a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    }
  }

  return (
    <div className="screen with-tabs">
      <Header title="Totals" />
      <div className="pad stack">
        <div className="seg">
          {years.map((y) => <button key={y} className={y === year ? 'on' : ''} onClick={() => setYear(y)}>{y}</button>)}
        </div>
        <div className="stats">
          <div><b>{money(total)}</b><span>billed</span></div>
          <div><b>{yearJobs.length}</b><span>jobs</span></div>
          <div><b>{money(yearJobs.length ? Math.round(total / yearJobs.length) : null)}</b><span>avg job</span></div>
          <div><b className={unpaid ? 'unpaid' : ''}>{money(unpaid)}</b><span>unpaid</span></div>
        </div>
        <div className="card list">
          {months.map((m) => (
            <div key={m.name} className="row month">
              <span className="m-name">{m.name}</span>
              <div className="bar"><div style={{ width: `${(m.total / max) * 100}%` }} /></div>
              <span className="m-count muted">{m.count || ''}</span>
              <span className="price">{m.total ? money(m.total) : '—'}</span>
            </div>
          ))}
        </div>
        <button className="btn big" onClick={exportCsv}>⬇︎ Export {year} as CSV</button>

        <div className="card">
          <div className="card-title">Backup</div>
          <p className="sub">
            {pending ? `${pending} change(s) waiting to upload. ` : 'Everything is backed up. '}
            {status.lastSync && <>Last sync {new Date(status.lastSync).toLocaleString()}.</>}
          </p>
          {status.error && <p className="sub err-text">{status.error}</p>}
          <div className="row-btns">
            <button className="btn" onClick={() => void sync()}>Sync now</button>
            <button className="btn danger" onClick={async () => {
              if (pending) { alert('You have changes that haven’t uploaded yet. Sync first so nothing is lost.'); return }
              if (confirm('Sign out? You will need signal to sign back in.')) await supabase.auth.signOut()
            }}>Sign out</button>
          </div>
        </div>
      </div>
      <TabBar active="reports" />
    </div>
  )
}
