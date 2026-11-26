/** Uses the shared xl breakpoint: compact layouts include phones and tablets. */
export const PAGI_DESKTOP_MIN_WIDTH = 1280
/** Selects compact Pagi behavior for phone and tablet viewport widths. */
export const isPagiMobileWidth = (width: number) => width < PAGI_DESKTOP_MIN_WIDTH

/** Server requests without viewport hints leave default lists to the browser. */
export const readPagiMobileLayout = (): boolean | null =>
  typeof window === 'undefined' ? null : isPagiMobileWidth(window.innerWidth)

/** Detects an explicit page or cursor URL so it wins over mutable defaults. */
export const hasExplicitPagiPosition = (
  search: Pick<URLSearchParams, 'get'>,
  keys: { api?: string; page: string; after: string } = { page: 'page', after: 'after' },
) =>
  (keys.api !== undefined && ['offset', 'cursor'].includes(search.get(keys.api) ?? '')) ||
  search.get(keys.page) !== null ||
  search.get(keys.after) !== null
