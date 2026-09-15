import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'

/*
 * This app has TWO bases and they are deliberately different. Do not collapse them.
 *
 *   ROUTES  live at the host root, so there is NO basename. The GitSite's root mount
 *           serves this shell for any extensionless browser GET that fails server-side
 *           routing, which makes /rocks and /l10 real, bookmarkable URLs.
 *           Nobody ever sees /spa/.
 *
 *   ASSETS  still live under /spa/. That is the only mount which streams files, and
 *           the root mount hard-404s anything with a file extension. Vite's `base`
 *           owns that at build time (import.meta.env.BASE_URL), which is why it must
 *           never be read back as a route prefix. It used to be — until 2026-09-15
 *           this file did exactly that — and that is the coupling this comment
 *           exists to stop someone restoring.
 *
 * ⚠️ The root funnel only fires for BROWSER NAVIGATIONS, which the platform detects
 * via the `Sec-Fetch-Mode: navigate` header. A plain curl of /rocks returns 404 and
 * looks like proof that root routing is unsupported. It is not — that false negative
 * is what put the /spa/ prefix here in the first place. Probe with:
 *   curl -H 'Sec-Fetch-Mode: navigate' https://hope-eos.bluestep.net/rocks
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
