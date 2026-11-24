import { useMemo, useState } from 'react'
import { fmtDate, money, type Job } from '../lib/db'
import { go } from '../lib/nav'
import { Header, TabBar, useAllData } from './common'

export function Home() {
  const { properties, jobs } = useAllData()
  const [q, setQ] = useState('')

  const byProp = useMemo(() => {
    const m = new Map<string, Job[]>()
    for (const j of jobs) {
      const arr = m.get(j.property_id) ?? []
      arr.push(j)
      m.set(j.property_id, arr)
    }
    for (const arr of m.values()) arr.sort((a, b) => b.job_date.localeCompare(a.job_date))
    return m
  }, [jobs])

  const propName = useMemo(() => new Map(properties.map((p) => [p.id, p.address || '(no address)'])), [properties])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return properties
      .filter((p) => !needle || `${p.address} ${p.client} ${p.notes} ${p.access_notes}`.toLowerCase().includes(needle))
      .map((p) => ({ p, js: byProp.get(p.id) ?? [] }))
      .sort((a, b) => (b.js[0]?.job_date ?? b.p.created_at).localeCompare(a.js[0]?.job_date ?? a.p.created_at))
  }, [properties, byProp, q])

  const recent = useMemo(
    () => [...jobs].sort((a, b) => b.job_date.localeCompare(a.job_date) || b.created_at.localeCompare(a.created_at)).slice(0, 8),
    [jobs],
  )

  return (
    <div className="screen with-tabs">
      <Header title="Pro Rinse Jobs" />
      <div className="pad">
        <input className="search" type="search" placeholder="Search address, client, notes…" value={q} onChange={(e) => setQ(e.target.value)} />

        {!q && recent.length > 0 && (
          <>
            <h2 className="section">Recent jobs</h2>
            <div className="card list">
              {recent.map((j) => (
                <button key={j.id} className="row" onClick={() => go('j/' + j.id)}>
                  <div className="grow">
                    <div className="title">{propName.get(j.property_id) ?? '—'}</div>
                    <div className="sub">{fmtDate(j.job_date)}{j.services.length ? ' · ' + j.services.join(', ') : ''}</div>
                  </div>
                  <div className={`price ${j.paid ? '' : 'unpaid'}`}>{money(j.price)}</div>
                </button>
              ))}
            </div>
          </>
        )}

        <h2 className="section">Properties {list.length ? <span className="muted">({list.length})</span> : null}</h2>
        {list.length === 0 && (
          <div className="empty">
            {q ? 'No matches.' : 'No properties yet. Tap ＋ to log your first job.'}
          </div>
        )}
        {list.length > 0 && (
          <div className="card list">
            {list.map(({ p, js }) => (
              <button key={p.id} className="row" onClick={() => go('p/' + p.id)}>
                <div className="grow">
                  <div className="title">{p.address || '(no address)'}</div>
                  <div className="sub">
                    {p.client && <>{p.client} · </>}
                    {js.length ? <>Last {fmtDate(js[0].job_date)} · {js.length} job{js.length > 1 ? 's' : ''}</> : 'No jobs yet'}
                  </div>
                </div>
                <div className="price">{js[0] ? money(js[0].price) : ''}</div>
              </button>
            ))}
          </div>
        )}
      </div>
      <TabBar active="home" />
    </div>
  )
}
