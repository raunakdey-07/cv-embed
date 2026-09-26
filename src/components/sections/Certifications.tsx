import { IconAward, IconPlus, IconX } from '../ui/Icons'
import type { CertificationItem } from '../../types/resume'

interface CertificationsSectionProps {
  certifications: CertificationItem[]
  onChange: (next: CertificationItem[]) => void
}

const empty: CertificationItem = { title: '', issuer: '', date: '', credentialId: '', credentialUrl: '' }

export function CertificationsSection({ certifications, onChange }: CertificationsSectionProps) {
  const add = () => onChange([...certifications, { ...empty }])
  const remove = (index: number) => onChange(certifications.filter((_, itemIndex) => itemIndex !== index))
  const update = (index: number, key: keyof CertificationItem, value: string) => onChange(certifications.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))

  return (
    <section className="panel">
      <div className="section-head">
        <IconAward size={16} />
        <h2 className="section-title">Certifications</h2>
        <span className="count-badge">{certifications.length}</span>
        <button type="button" className="ghost-add" title="Add certification" aria-label="Add certification" onClick={add}><IconPlus size={14} /></button>
      </div>
      <div className="field-stack">
        {certifications.length === 0 ? <p className="section-empty">No certifications added yet.</p> : certifications.map((item, index) => (
          <div className="card" key={`cert-${index}`}>
            <button type="button" className="card-close" title="Remove certification" aria-label={`Remove certification ${index + 1}`} onClick={() => remove(index)}><IconX size={12} /></button>
            <div className="field-grid">
              <label>Title <input name={`certification-${index}-title`} value={item.title} onChange={(event) => update(index, 'title', event.target.value)} /></label>
              <label>Issuer <input name={`certification-${index}-issuer`} value={item.issuer} onChange={(event) => update(index, 'issuer', event.target.value)} /></label>
              <label>Date <input name={`certification-${index}-date`} value={item.date} onChange={(event) => update(index, 'date', event.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>Credential ID <input name={`certification-${index}-id`} value={item.credentialId} onChange={(event) => update(index, 'credentialId', event.target.value)} /></label>
              <label>Credential URL <input name={`certification-${index}-url`} type="url" value={item.credentialUrl} onChange={(event) => update(index, 'credentialUrl', event.target.value)} placeholder="https://..." /></label>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
