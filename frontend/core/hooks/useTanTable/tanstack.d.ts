// types/tanstack-table.d.ts (推荐放到一个 .d.ts 里)
import '@tanstack/table-core'

declare module '@tanstack/table-core' {
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  interface ColumnMeta<TData, TValue> {
    sticky?: 'left' | 'right'
  }
}
