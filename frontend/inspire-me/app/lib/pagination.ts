export function clampPage(page: string | undefined, totalPages: number): number {
  const value = Number.parseInt(page ?? '1', 10)
  if (!Number.isFinite(value)) return 1

  return Math.min(Math.max(value, 1), totalPages)
}
