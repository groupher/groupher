import '@tanstack/table-core'

declare module '@tanstack/table-core' {
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  interface ColumnMeta<TData, TValue> {
    sticky?: 'left' | 'right'
  }
}
