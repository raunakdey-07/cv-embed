import { Route, Routes, useLocation } from 'react-router-dom'
import { BuilderPage } from './app/builder/BuilderPage'
import { EmbedPage } from './app/embed/EmbedPage'
import { IconLink } from './components/ui/Icons'

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

function App() {
  const location = useLocation()
  const isEmbedRoute = location.pathname.startsWith('/embed/')

  return (
    <div className="app-shell">
      {!isEmbedRoute ? (
        <header className="app-header">
          <div className="app-header-inner">
            <div className="brand-row">
              <h1>CV-Embed</h1>
            </div>
            <HeaderEmbedButton />
          </div>
        </header>
      ) : null}
      <Routes>
        <Route path="/" element={<BuilderPage />} />
        <Route path="/builder" element={<BuilderPage />} />
        <Route path="/embed/:resumeId" element={<EmbedPage />} />
      </Routes>
    </div>
  )
}

export default App
