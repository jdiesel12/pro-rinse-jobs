import { useMemo, useState } from 'react'
import { createJob, createProperty } from '../lib/db'
import { replace } from '../lib/nav'
import { Header, useAllData } from './common'

export function NewJob() {
  const { properties, jobs } = useAllData()
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()

  const matches = useMemo(() => {
    const last = new Map<string, string>()
    for (const j of jobs) if ((last.get(j.property_id) ?? '') < j.job_date) last.set(j.property_id, j.job_date)
    return properties
      .filter((p) => !needle || `${p.address} ${p.client}`.toLowerCase().includes(needle))
      .sort((a, b) => (last.get(b.id) ?? '').localeCompare(last.get(a.id) ?? ''))
      .slice(0, 30)
  }, [properties, jobs, needle])

  async function pick(propertyId: string) {
    const id = await createJob(propertyId)
    replace('j/' + id + '/new')
  }
  async function createNew() {
    const pid = await createProperty(q)
    await pick(pid)
  }

  return (
    <div className="screen">
      <Header title="New job" backBtn />
      <div className="pad">
        <p className="muted">Which property?</p>
        <input className="search" autoFocus type="search" placeholder="Type an address…" value={q} onChange={(e) => setQ(e.target.value)} />
        {needle && (
          <button className="btn primary big full" onClick={createNew}>＋ New property: “{q.trim()}”</button>
        )}
        {matches.length > 0 && (
          <div className="card list">
            {matches.map((p) => (
              <button key={p.id} className="row" onClick={() => pick(p.id)}>
                <div className="grow">
                  <div className="title">{p.address || '(no address)'}</div>
                  {p.client && <div className="sub">{p.client}</div>}
                </div>
                <span className="chev">›</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
