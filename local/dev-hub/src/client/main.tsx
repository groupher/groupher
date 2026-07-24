import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Dev Hub root element is missing.')

if ('__TAURI_INTERNALS__' in window) {
  document.documentElement.classList.add('desktop-shell')
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary
      title='Dev Hub could not be displayed'
      message='Reload the local dashboard to reconnect to the managed services.'
      actionLabel='Reload Dev Hub'
      variant='page'
      onReset={() => window.location.reload()}
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
