export const getGridColumns = (count: number): number => Math.ceil(Math.sqrt(count))

export const getGridRows = (count: number): number => Math.ceil(count / getGridColumns(count))
