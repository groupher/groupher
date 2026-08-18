/**
 * Implements the App Lib Pagination boundary inside Inspire Me.
 *
 * Business position:
 *
 *   Research dataset
 *     -> Inspire Me module
 *     -> Vinext / Worker UI
 *     -> researcher
 */

/** Runs the clamp page operation at the inspire me boundary. */
export function clampPage(page: string | undefined, totalPages: number): number {
  const value = Number.parseInt(page ?? '1', 10)
  if (!Number.isFinite(value)) return 1

  return Math.min(Math.max(value, 1), totalPages)
}
