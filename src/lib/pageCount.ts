/**
 * Page-count display contract.
 *
 * A page count is either *measured* or it is not. "Unmeasured" is 0, and an
 * unmeasured count has no UI at all: showing a placeholder such as
 * "not checked" tells the user nothing actionable and, worse, a placeholder
 * reading "1" would claim a measurement that never happened. An empty resume
 * happens to render on one page, but that is a property of the preview
 * canvas, not a measured PDF page count, so it must not display one.
 */
export const UNMEASURED_PAGE_COUNT = 0

export interface PageCountIndicator {
  text: string
  title: string
}

/** True only when a real PDF measurement supplied a positive page count. */
export function isPageCountMeasured(pageCount: number): boolean {
  return Number.isFinite(pageCount) && pageCount > 0
}

/**
 * Returns the indicator to render, or null when there is nothing measured to
 * report. Callers must not render a placeholder in the null case.
 */
export function resolvePageCountIndicator(
  pageCount: number,
  options: { isEstimating: boolean; isStale: boolean } = { isEstimating: false, isStale: false },
): PageCountIndicator | null {
  if (!isPageCountMeasured(pageCount)) return null

  const label = options.isEstimating && options.isStale ? 'Est. PDF pages' : 'PDF pages'
  return {
    text: `${label}: ${pageCount}`,
    title: 'Estimated A4 pages in the PDF export. Checking starts when you open export or embed tools.',
  }
}
