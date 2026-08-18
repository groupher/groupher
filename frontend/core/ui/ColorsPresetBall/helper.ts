/** Returns grid columns for the frontend shared workflow. */
export const getGridColumns = (count: number): number => {
  if (count === 0) return 0

  return Math.ceil(Math.sqrt(count))
}

/** Returns grid rows for the frontend shared workflow. */
export const getGridRows = (count: number): number => {
  if (count === 0) return 0

  return Math.ceil(count / getGridColumns(count))
}
