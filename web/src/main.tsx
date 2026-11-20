import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

// Back from OSM's sign-in in this window (see osmAuth.ts): only then is its code loaded.
try {
  if (sessionStorage.getItem('osm-auth-answer') !== null) import('./osmAuth').then((m) => m.resumeSignIn())
} catch {
  // No storage, no sign-in to finish.
}

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
