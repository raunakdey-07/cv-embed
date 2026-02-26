import { IconAward, IconPlus, IconX } from '../ui/Icons'
import type { CertificationItem } from '../../types/resume'

interface CertificationsSectionProps {
  certifications: CertificationItem[]
  onChange: (next: CertificationItem[]) => void
}

const empty: CertificationItem = { title: '', issuer: '', date: '', credentialId: '', credentialUrl: '' }

export function CertificationsSection({ certifications, onChange }: CertificationsSectionProps) {
  const items = certifications.length > 0 ? certifications : [empty]

  const add = () => onChange([...items, { ...empty }])
  const remove = (i: number) => { const n = items.filter((_, j) => j !== i); onChange(n.length > 0 ? n : [{ ...empty }]) }
  const update = (i: number, k: keyof CertificationItem, v: string) => onChange(items.map((x, j) => j === i ? { ...x, [k]: v } : x))

  return (
    <section className="panel">
      <div className="section-head">
        <IconAward size={16} />
        <span className="section-title">Certifications</span>
        <span className="count-badge">{items.length}</span>
        <button type="button" className="ghost-add" title="Add certification" onClick={add}><IconPlus size={14} /></button>
      </div>
      <div className="field-stack">
        {items.map((item, i) => (
          <div className="card" key={`cert-${i}`}>
            <button type="button" className="card-close" title="Remove" onClick={() => remove(i)}><IconX size={12} /></button>
            <div className="field-grid">
              <label>Title <input value={item.title} onChange={(e) => update(i, 'title', e.target.value)} /></label>
              <label>Issuer <input value={item.issuer} onChange={(e) => update(i, 'issuer', e.target.value)} /></label>
              <label>Date <input value={item.date} onChange={(e) => update(i, 'date', e.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>Credential ID <input value={item.credentialId} onChange={(e) => update(i, 'credentialId', e.target.value)} /></label>
              <label>Credential URL <input value={item.credentialUrl} onChange={(e) => update(i, 'credentialUrl', e.target.value)} placeholder="https://..." /></label>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
