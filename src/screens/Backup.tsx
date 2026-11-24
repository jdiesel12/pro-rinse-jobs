import { supabase } from '../lib/supabase'
import { sync, usePendingCount, useSyncStatus } from '../lib/sync'
import { Header, useOnline } from './common'
import { ICheck, ICloud, ICloudOff, ILogout, IRefresh } from './icons'

export function Backup() {
  const status = useSyncStatus()
  const pending = usePendingCount()
  const online = useOnline()

  let tone = 'ok', icon = <ICheck size={34} strokeWidth={2.6} />, title = 'All backed up', body = 'Every job and photo is safe in the cloud.'
  if (status.state === 'syncing') { tone = 'busy'; icon = <IRefresh size={34} className="spin" />; title = 'Syncing…'; body = 'Uploading your latest changes.' }
  else if (!online) { tone = pending ? 'warn' : 'off'; icon = <ICloudOff size={34} />; title = pending ? `${pending} change${pending > 1 ? 's' : ''} saved on phone` : 'Offline'; body = pending ? 'They’re safe on this phone and will upload when you have signal and the app is open.' : 'You can keep logging jobs. Everything saves on the phone.' }
  else if (status.error) { tone = 'err'; icon = <ICloud size={34} />; title = 'Sync problem'; body = status.error }
  else if (pending) { tone = 'warn'; icon = <ICloud size={34} />; title = `${pending} waiting to upload`; body = 'Uploading shortly.' }

  return (
    <div className="screen">
      <Header title="Backup" backBtn right={<span />} />
      <div className="pad stack">
        <div className={`status-hero ${tone}`}>
          <div className="status-icon">{icon}</div>
          <h2>{title}</h2>
          <p>{body}</p>
          {status.lastSync && <p className="muted small">Last sync {new Date(status.lastSync).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>}
        </div>
        <button className="btn big" onClick={() => void sync()}><IRefresh size={18} /> Sync now</button>
        <button className="text-danger" onClick={async () => {
          if (pending) { alert('You have changes that haven’t uploaded yet. Sync first so nothing is lost.'); return }
          if (confirm('Sign out? You will need signal to sign back in.')) await supabase.auth.signOut()
        }}><ILogout size={16} /> Sign out</button>
      </div>
    </div>
  )
}
