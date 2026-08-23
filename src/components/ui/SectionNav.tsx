import { useEffect, useRef } from 'react'
import { IconChevronDown, IconSliders } from '../ui/Icons'
import type { DocumentOptions, ResumeSectionKey } from '../../types/resume'

export interface NavSection {
  id: string
  label: string
  active: boolean
  hidden: boolean
}

interface SectionNavProps {
  sections: NavSection[]
  organizeOpen: boolean
  showSections: DocumentOptions['showSections']
  sectionOrder: ResumeSectionKey[]
  onToggleSection: (sectionId: keyof DocumentOptions['showSections']) => void
  onMoveSection: (sectionId: keyof DocumentOptions['showSections'], direction: -1 | 1) => void
  onSelect: (id: string) => void
  onOrganizeToggle: () => void
  onOrganizeClose: () => void
}

const ORDER_LABELS: Record<keyof DocumentOptions['showSections'], string> = {
  summary: 'Summary',
  education: 'Education',
  experience: 'Experience',
  projects: 'Projects',
  skills: 'Skills',
  certifications: 'Certifications',
  accomplishments: 'Accomplishments',
  activities: 'Activities',
  volunteering: 'Volunteering',
  publications: 'Publications',
}

export function SectionNav({
  sections,
  organizeOpen,
  showSections,
  sectionOrder,
  onToggleSection,
  onMoveSection,
  onSelect,
  onOrganizeToggle,
  onOrganizeClose,
}: SectionNavProps) {
  const rootRef = useRef<HTMLElement>(null)

  // Close the organize sheet on outside click or Escape.
  useEffect(() => {
    if (!organizeOpen) return

    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onOrganizeClose()
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOrganizeClose()
    }

    document.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onOrganizeClose, organizeOpen])

  const orderedSections = sectionOrder.length > 0 ? sectionOrder : []

  return (
    <nav className="section-nav" ref={rootRef}>
      <div className="section-nav-tabs">
        {sections.map((s) => (
          <button
            key={s.id}
            className={`nav-tab ${s.active ? 'active' : ''} ${s.hidden ? 'is-hidden-section' : ''}`}
            onClick={() => onSelect(s.id)}
            title={s.hidden ? `${s.label} (hidden from resume)` : s.label}
          >
            <span>{s.label}</span>
          </button>
        ))}
      </div>
      <div className="organize-wrap">
        <button
          type="button"
          className={`organize-btn ${organizeOpen ? 'active' : ''}`}
          title="Organize sections"
          aria-label="Organize sections"
          aria-expanded={organizeOpen}
          onClick={onOrganizeToggle}
        >
          <IconSliders size={13} />
          <IconChevronDown size={9} />
        </button>
        {organizeOpen ? (
          <div className="organize-sheet" role="dialog" aria-label="Visibility and order">
            <p className="organize-sheet-title">Visibility &amp; Order</p>
            <div className="order-list">
              {orderedSections.map((sectionId, index) => (
                <div className="order-item" key={sectionId}>
                  <label className="order-toggle">
                    <input
                      type="checkbox"
                      checked={showSections[sectionId]}
                      onChange={() => onToggleSection(sectionId)}
                    />
                    <span>{ORDER_LABELS[sectionId]}</span>
                  </label>
                  <div className="order-actions">
                    <button
                      type="button"
                      className="order-btn"
                      onClick={() => onMoveSection(sectionId, -1)}
                      disabled={index === 0}
                      title="Move up"
                    >↑</button>
                    <button
                      type="button"
                      className="order-btn"
                      onClick={() => onMoveSection(sectionId, 1)}
                      disabled={index === orderedSections.length - 1}
                      title="Move down"
                    >↓</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </nav>
  )
}
