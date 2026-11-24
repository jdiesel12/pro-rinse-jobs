import { supabase } from '../lib/supabase'
import { sync, usePendingCount, useSyncStatus } from '../lib/sync'
import { Header } from './common'

export function Backup() {
  const status = useSyncStatus()
  const pending = usePendingCount()
  return (
    <div className="screen">
      <Header title="Backup" backBtn />
      <div className="pad stack">
        <div className="card">
          <p className="sub">
            {pending ? `${pending} change(s) waiting to upload. ` : 'Everything is backed up. '}
            {status.lastSync && <>Last sync {new Date(status.lastSync).toLocaleString()}.</>}
          </p>
          {status.state === 'offline' && <p className="sub">No signal right now. It’ll upload once you’re back online with the app open.</p>}
          {status.error && <p className="sub err-text">{status.error}</p>}
        </div>
        <button className="btn big" onClick={() => void sync()}>Sync now</button>
        <button className="btn danger" onClick={async () => {
          if (pending) { alert('You have changes that haven’t uploaded yet. Sync first so nothing is lost.'); return }
          if (confirm('Sign out? You will need signal to sign back in.')) await supabase.auth.signOut()
        }}>Sign out</button>
      </div>
    </div>
  )
}
