import { useMemo, useState } from 'react'
import { createJob, createProperty, propSubtitle, propTitle } from '../lib/db'
import { replace } from '../lib/nav'
import { Header, relDate, useAllData } from './common'
import { IChevron, IHome, IPlus, ISearch } from './icons'

export function NewJob() {
  const { properties, jobs } = useAllData()
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()

  const { matches, last } = useMemo(() => {
    const last = new Map<string, string>()
    for (const j of jobs) if ((last.get(j.property_id) ?? '') < j.job_date) last.set(j.property_id, j.job_date)
    const matches = properties
      .filter((p) => !needle || `${p.name ?? ''} ${p.address} ${p.client}`.toLowerCase().includes(needle))
      .sort((a, b) => (last.get(b.id) ?? '').localeCompare(last.get(a.id) ?? ''))
      .slice(0, 30)
    return { matches, last }
  }, [properties, jobs, needle])

  const exact = properties.some((p) => p.address.trim().toLowerCase() === needle || (p.name ?? '').trim().toLowerCase() === needle)

  async function pick(propertyId: string) {
    const id = await createJob(propertyId)
    replace('j/' + id + '/new')
  }
  async function createNew() {
    await pick(await createProperty(q))
  }

  return (
    <div className="screen">
      <Header title="New job" backBtn right={<span />} />
      <div className="pad stack">
        <div>
          <h2 className="big-q">Where’s the job?</h2>
          <p className="muted">Search by name or address, or type a new address.</p>
        </div>
        <label className="searchbar solid">
          <ISearch size={18} />
          <input autoFocus type="search" placeholder="Name or address" value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && needle && !exact) void createNew() }} />
        </label>

        {matches.length > 0 && (
          <>
            <h2 className="section">{needle ? 'Matches' : 'Recent properties'}</h2>
            <div className="card list">
              {matches.map((p) => (
                <button key={p.id} className="row" onClick={() => pick(p.id)}>
                  <span className="cover row-cover sm"><IHome size={18} /></span>
                  <div className="grow">
                    <div className="title">{propTitle(p)}</div>
                    {propSubtitle(p) && <div className="sub addr-line">{propSubtitle(p)}</div>}
                    <div className="sub">{last.get(p.id) ? `Last ${relDate(last.get(p.id)!)}` : 'No jobs yet'}{p.client && ` · ${p.client}`}</div>
                  </div>
                  <IChevron size={18} className="chev" />
                </button>
              ))}
            </div>
          </>
        )}
        {needle && !exact && (
          <button className="create-row" onClick={createNew}>
            <span className="create-icon"><IPlus size={20} strokeWidth={2.6} /></span>
            <span className="grow">
              <span className="title">Add new property</span>
              <span className="sub block">{q.trim()}</span>
            </span>
            <IChevron size={18} className="chev" />
          </button>
        )}

      </div>
    </div>
  )
}
