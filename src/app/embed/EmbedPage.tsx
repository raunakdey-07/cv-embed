import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { TemplateRenderer } from '../../components/templates/TemplateRenderer'
import { loadEmbedResume } from '../../lib/storage'
import { decodeResumeFromUrl } from '../../lib/utils'

export function EmbedPage() {
  const { resumeId } = useParams()
  const [searchParams] = useSearchParams()

  const showDownload = searchParams.get('showDownload') !== '0'
  const primaryColor = searchParams.get('primaryColor') ?? '#111111'
  const density = searchParams.get('density') === 'compact' ? 'compact' : 'normal'

  const resume = useMemo(() => {
    const encodedData = searchParams.get('data')
    if (encodedData) {
      const decoded = decodeResumeFromUrl(encodedData)
      if (decoded) {
        return decoded
      }
    }

    if (!resumeId) {
      return null
    }

    return loadEmbedResume(resumeId)
  }, [resumeId, searchParams])

  if (!resume) {
    return (
      <main className="app-main single-pane">
        <section className="panel">
          <h2>Resume not found</h2>
          <p>This embed payload is missing or invalid.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="app-main single-pane">
      <section className="panel">
        <TemplateRenderer resume={resume} primaryColor={primaryColor} density={density} />
        {showDownload ? (
          <a className="link-button" href="/builder" target="_blank" rel="noreferrer">
            Open in Builder
          </a>
        ) : null}
      </section>
    </main>
  )
}
