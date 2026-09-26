import { IconFlag, IconPlus, IconX } from '../ui/Icons'
import type { ActivityItem } from '../../types/resume'

interface ActivitiesSectionProps {
  activities: ActivityItem[]
  onChange: (next: ActivityItem[]) => void
}

const empty: ActivityItem = { role: '', organization: '', location: '', startDate: '', endDate: '', referenceUrl: '' }

export function ActivitiesSection({ activities, onChange }: ActivitiesSectionProps) {
  const add = () => onChange([...activities, { ...empty }])
  const remove = (index: number) => onChange(activities.filter((_, itemIndex) => itemIndex !== index))
  const update = (index: number, key: keyof ActivityItem, value: string) => onChange(activities.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))

  return (
    <section className="panel">
      <div className="section-head">
        <IconFlag size={16} />
        <h2 className="section-title">Activities</h2>
        <span className="count-badge">{activities.length}</span>
        <button type="button" className="ghost-add" title="Add activity" aria-label="Add activity" onClick={add}><IconPlus size={14} /></button>
      </div>
      <div className="field-stack">
        {activities.length === 0 ? <p className="section-empty">No activities added yet.</p> : activities.map((item, index) => (
          <div className="card" key={`act-${index}`}>
            <button type="button" className="card-close" title="Remove activity" aria-label={`Remove activity ${index + 1}`} onClick={() => remove(index)}><IconX size={12} /></button>
            <div className="field-grid">
              <label>Role <input name={`activity-${index}-role`} value={item.role} onChange={(event) => update(index, 'role', event.target.value)} /></label>
              <label>Organization <input name={`activity-${index}-organization`} value={item.organization} onChange={(event) => update(index, 'organization', event.target.value)} /></label>
              <label>Start <input name={`activity-${index}-start`} value={item.startDate} onChange={(event) => update(index, 'startDate', event.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>End <input name={`activity-${index}-end`} value={item.endDate} onChange={(event) => update(index, 'endDate', event.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>Location <input name={`activity-${index}-location`} value={item.location} onChange={(event) => update(index, 'location', event.target.value)} /></label>
              <label>Reference URL <input name={`activity-${index}-url`} type="url" value={item.referenceUrl} onChange={(event) => update(index, 'referenceUrl', event.target.value)} placeholder="https://..." /></label>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
