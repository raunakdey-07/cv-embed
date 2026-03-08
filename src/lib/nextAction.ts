export type BuilderSectionId =
  | 'basics'
  | 'education'
  | 'experience'
  | 'projects'
  | 'skills'
  | 'certifications'
  | 'accomplishments'
  | 'activities'
  | 'volunteering'
  | 'publications'
  | 'document-options'

export function resolveNextActionSection(
  firstMissingEssentialSection: BuilderSectionId | null,
  nextIssueSection: BuilderSectionId | null,
): BuilderSectionId | null {
  return firstMissingEssentialSection ?? nextIssueSection
}
