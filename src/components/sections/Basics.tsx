import { IconPlus, IconUser, IconX } from '../ui/Icons'
import type { ResumeBasics } from '../../types/resume'
import type { DocumentOptions } from '../../types/resume'

interface BasicsSectionProps {
  basics: ResumeBasics
  linkDisplay: DocumentOptions['linkDisplay']
  onLinkDisplayChange: (next: DocumentOptions['linkDisplay']) => void
  onChange: (next: ResumeBasics) => void
}

const LINK_LABEL_OPTIONS = ['LinkedIn', 'GitHub', 'Portfolio', 'LeetCode', 'HackerRank', 'X', 'Other']

export function BasicsSection({ basics, linkDisplay, onLinkDisplayChange, onChange }: BasicsSectionProps) {
  const updateLink = (index: number, key: 'label' | 'url', value: string) => {
    const links = basics.links.map((link, linkIndex) =>
      linkIndex === index ? { ...link, [key]: value } : link,
    )
    onChange({ ...basics, links })
  }

  const addLink = () => {
    onChange({ ...basics, links: [...basics.links, { label: 'LinkedIn', url: '' }] })
  }

  const removeLink = (index: number) => {
    const next = basics.links.filter((_, linkIndex) => linkIndex !== index)
    onChange({ ...basics, links: next.length > 0 ? next : [{ label: '', url: '' }] })
  }

  return (
    <section className="panel">
      <div className="section-head">
        <IconUser size={16} />
        <span className="section-title">Basics</span>
      </div>
      <div className="field-grid">
        <label>
          Name
          <input value={basics.name} onChange={(e) => onChange({ ...basics, name: e.target.value })} placeholder="Full name" />
        </label>
        <label>
          Headline
          <input value={basics.headline} onChange={(e) => onChange({ ...basics, headline: e.target.value })} placeholder="Frontend Engineer | ML Enthusiast" />
        </label>
        <label>
          Email
          <input value={basics.email} onChange={(e) => onChange({ ...basics, email: e.target.value })} placeholder="name@email.com" />
        </label>
        <label>
          Phone
          <input value={basics.phone} onChange={(e) => onChange({ ...basics, phone: e.target.value })} placeholder="+91..." />
        </label>
        <label>
          Location
          <input value={basics.location} onChange={(e) => onChange({ ...basics, location: e.target.value })} placeholder="City, State" />
        </label>
      </div>
      <label>
        Summary
        <textarea rows={3} value={basics.summary} onChange={(e) => onChange({ ...basics, summary: e.target.value })} placeholder="2–3 line professional summary" />
      </label>

      <div className="section-head sub">
        <span className="section-title">Links</span>
        <span className="count-badge">{basics.links.length}</span>
        <label className="inline-select-wrap">
          <span className="inline-select-label">Display</span>
          <select
            className="inline-select"
            value={linkDisplay}
            onChange={(e) => onLinkDisplayChange(e.target.value as DocumentOptions['linkDisplay'])}
          >
            <option value="label">Short</option>
            <option value="url">Full URL</option>
          </select>
        </label>
        <button type="button" className="ghost-add" title="Add link" onClick={addLink}><IconPlus size={14} /></button>
      </div>
      <div className="field-stack">
        {basics.links.map((link, index) => {
          const hasKnownLabel = !!link.label && LINK_LABEL_OPTIONS.includes(link.label)
          const showCustomLabel = link.label === 'Other' || (!!link.label && !LINK_LABEL_OPTIONS.includes(link.label))
          return (
            <div className="card" key={`link-${index}`}>
              <button type="button" className="card-close" title="Remove" onClick={() => removeLink(index)}><IconX size={12} /></button>
              <div className="field-grid">
                <label>
                  Label
                  <select
                    value={showCustomLabel ? 'Other' : hasKnownLabel ? link.label : 'LinkedIn'}
                    onChange={(e) => updateLink(index, 'label', e.target.value === 'Other' ? 'Other' : e.target.value)}
                  >
                    {LINK_LABEL_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </label>
                <label>
                  URL
                  <input value={link.url} onChange={(e) => updateLink(index, 'url', e.target.value)} placeholder="https://..." />
                </label>
              </div>
              {showCustomLabel ? (
                <label>
                  Custom Label
                  <input value={link.label === 'Other' ? '' : link.label} onChange={(e) => updateLink(index, 'label', e.target.value)} placeholder="Platform name" />
                </label>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
