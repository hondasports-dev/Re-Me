import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AppProviders } from './providers'
import '../styles/base.css'
import '../styles/motion.css'

const rootElement = document.getElementById('app')

if (!rootElement) {
  throw new Error('app_root_missing')
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
)
