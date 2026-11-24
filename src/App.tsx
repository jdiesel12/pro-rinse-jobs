import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { startAutoSync } from './lib/sync'
import { Login } from './screens/Login'
import { Home } from './screens/Home'
import { NewJob } from './screens/NewJob'
import { JobScreen } from './screens/JobScreen'
import { PropertyScreen } from './screens/PropertyScreen'
import { Reports } from './screens/Reports'

// Tiny hash router so iOS swipe-back works in the installed app.
function useRoute() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => { setHash(location.hash); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash.replace(/^#\/?/, '').split('/')
}

export default function App() {
  // The owner id is cached locally so the app opens with zero signal.
  const [owner, setOwner] = useState(localStorage.getItem('owner'))

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        localStorage.setItem('owner', session.user.id)
        setOwner(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('owner')
        setOwner(null)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => (owner ? startAutoSync() : undefined), [owner])

  const [page, a] = useRoute()
  if (!owner) return <Login />

  switch (page) {
    case 'new': return <NewJob />
    case 'j': return <JobScreen key={a} id={a} owner={owner} />
    case 'p': return <PropertyScreen key={a} id={a} />
    case 'reports': return <Reports />
    default: return <Home />
  }
}
