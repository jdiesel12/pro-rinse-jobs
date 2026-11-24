import { useMemo, useState } from 'react'
import { money, type Job } from '../lib/db'
import { go } from '../lib/nav'
import { AddButton, Cover, relDate, SyncBadge, useAllData, useCoverPhotos } from './common'
import { IChevron, IDroplet, ISearch, IX } from './icons'

export function Home() {
  const { properties, jobs } = useAllData()
  const [q, setQ] = useState('')

  const byProp = useMemo(() => {
    const m = new Map<string, Job[]>()
    for (const j of jobs) m.set(j.property_id, [...(m.get(j.property_id) ?? []), j])
    for (const arr of m.values()) arr.sort((a, b) => b.job_date.localeCompare(a.job_date))
    return m
  }, [jobs])

  const propName = useMemo(() => new Map(properties.map((p) => [p.id, p.address || 'No address'])), [properties])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return properties
      .filter((p) => !needle || `${p.address} ${p.client} ${p.notes} ${p.access_notes}`.toLowerCase().includes(needle))
      .map((p) => ({ p, js: byProp.get(p.id) ?? [] }))
      .sort((a, b) => (b.js[0]?.job_date ?? b.p.created_at).localeCompare(a.js[0]?.job_date ?? a.p.created_at))
  }, [properties, byProp, q])

  const recent = useMemo(
    () => [...jobs].sort((a, b) => b.job_date.localeCompare(a.job_date) || b.created_at.localeCompare(a.created_at)).slice(0, 10),
    [jobs],
  )
  const covers = useCoverPhotos(useMemo(
    () => [...new Set([...recent.map((j) => j.id), ...list.map((x) => x.js[0]?.id).filter(Boolean) as string[]])],
    [recent, list],
  ))

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="screen with-fab">
      <section className="hero">
        <div className="hero-top">
          <span className="brand"><IDroplet size={16} strokeWidth={2.4} /> PRO RINSE</span>
          <SyncBadge glass />
        </div>
        <h1 className="hero-title">Jobs</h1>
        <p className="hero-sub">{today}</p>
        <label className="searchbar">
          <ISearch size={18} />
          <input type="search" placeholder="Search address, client, notes" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button aria-label="Clear" onClick={() => setQ('')}><IX size={16} /></button>}
        </label>
      </section>

      {!q && recent.length > 0 && (
        <>
          <h2 className="section pad-x">Recent</h2>
          <div className="carousel">
            {recent.map((j) => (
              <button key={j.id} className="rcard" onClick={() => go('j/' + j.id)}>
                <Cover photo={covers.get(j.id)} className="rcard-img" />
                <div className="rcard-body">
                  <div className="rcard-addr">{propName.get(j.property_id) ?? '—'}</div>
                  <div className="rcard-meta">
                    <span>{relDate(j.job_date)}</span>
                    {j.price != null && <span className="pill">{money(j.price)}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="pad">
        <h2 className="section">
          {q ? 'Results' : 'Properties'} {list.length > 0 && <span className="count">{list.length}</span>}
        </h2>

        {list.length === 0 && !q && (
          <div className="empty-state">
            <div className="empty-icon"><IDroplet size={34} /></div>
            <h3>No jobs yet</h3>
            <p>Log your first job: address, price, and a few before & after shots.</p>
            <button className="btn primary" onClick={() => go('new')}>Log a job</button>
          </div>
        )}
        {list.length === 0 && q && <div className="empty">Nothing matches “{q}”.</div>}

        {list.length > 0 && (
          <div className="card list">
            {list.map(({ p, js }) => (
              <button key={p.id} className="row" onClick={() => go('p/' + p.id)}>
                <Cover photo={js[0] ? covers.get(js[0].id) : undefined} className="row-cover" />
                <div className="grow">
                  <div className="title">{p.address || 'No address'}</div>
                  <div className="sub">
                    {js.length ? `${relDate(js[0].job_date)} · ${js.length} job${js.length > 1 ? 's' : ''}` : 'No jobs yet'}
                    {p.client && ` · ${p.client}`}
                  </div>
                </div>
                {js[0]?.price != null && <span className="row-price">{money(js[0].price)}</span>}
                <IChevron size={18} className="chev" />
              </button>
            ))}
          </div>
        )}
      </div>
      <AddButton />
    </div>
  )
}
