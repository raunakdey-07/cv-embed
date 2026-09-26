import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { BuilderPage } from './app/builder/BuilderPage'
import { EmbedPage } from './app/embed/EmbedPage'
import { IconLink, IconUpload } from './components/ui/Icons'

function HeaderEmbedButton() {
  const toggle = () => {
    window.dispatchEvent(new CustomEvent('cvembed:toggle-embed'))
  }

  return (
    <button
      type="button"
      className="header-embed-btn"
      title="Embed resume"
      aria-label="Embed resume"
      onClick={toggle}
    >
      <IconLink size={14} />
      <span>Embed</span>
    </button>
  )
}

function NotFoundPage() {
  return (
    <main id="main-content" className="app-main single-pane">
      <section className="panel">
        <h2>Page not found</h2>
        <p>Check the address or return to the CV builder.</p>
        <Link className="link-button" to="/">Open CV Builder</Link>
      </section>
    </main>
  )
}

function HeaderImportButton() {
  const openImport = () => {
    window.dispatchEvent(new CustomEvent('cvembed:import-json'))
  }

  return (
    <button
      type="button"
      className="header-import-btn"
      title="Import resume JSON"
      aria-label="Import resume JSON"
      onClick={openImport}
    >
      <IconUpload size={14} />
      <span>Import</span>
    </button>
  )
}

function App() {
  const location = useLocation()
  const isEmbedRoute = location.pathname.startsWith('/embed/')

  return (
    <div className={`app-shell${isEmbedRoute ? ' embed-shell' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to editor</a>
      {!isEmbedRoute ? (
        <header className="app-header">
          <div className="app-header-inner">
            <div className="brand-row">
              <h1>CV-Embed</h1>
            </div>
            <div className="app-header-actions">
              <HeaderImportButton />
              <HeaderEmbedButton />
            </div>
          </div>
        </header>
      ) : null}
      <Routes>
        <Route path="/" element={<BuilderPage />} />
        <Route path="/builder" element={<BuilderPage />} />
        <Route path="/embed/:resumeId" element={<EmbedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  )
}

export default App
