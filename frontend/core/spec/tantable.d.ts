// core/src/types/tanstack-table.d.ts
import type { RowData } from '@tanstack/table-core'

declare module '@tanstack/table-core' {
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: 'left' | 'center' | 'right'
    sticky?: 'left' | 'right'
  }
}
