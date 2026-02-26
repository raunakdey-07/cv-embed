import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BuilderPage } from './app/builder/BuilderPage'
import { EmbedPage } from './app/embed/EmbedPage'

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
              <span className="brand-pill">v1</span>
            </div>
          </div>
        </header>
      ) : null}
      <Routes>
        <Route path="/" element={<Navigate to="/builder" replace />} />
        <Route path="/builder" element={<BuilderPage />} />
        <Route path="/embed/:resumeId" element={<EmbedPage />} />
      </Routes>
    </div>
  )
}

export default App
