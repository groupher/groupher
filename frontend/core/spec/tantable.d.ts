// core/src/types/tanstack-table.d.ts
import '@tanstack/table-core'

declare module '@tanstack/table-core' {
  interface ColumnMeta<TData, TValue> {
    align?: 'left' | 'center' | 'right'
    sticky?: 'left' | 'right'
  }
}
