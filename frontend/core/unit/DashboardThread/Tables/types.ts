import type { ColumnDef, OnChangeFn, SortingState } from '@tanstack/react-table'
import type { MutableRefObject, ReactNode } from 'react'
import type { MultiSelectionTableMeta } from '~/hooks/useTanTable'

export type TCmsTableBatchActions = {
  onCancelAction: () => void
  onConfirmAction?: () => void
  withCategory?: boolean
  withDelete?: boolean
  withState?: boolean
  withTags?: boolean
}

export type TCmsTableSearch = {
  onChangeAction: (value: string) => void
  placeholder?: string
  value: string
}

export type TCmsTableToolbarProps = {
  batchActions?: TCmsTableBatchActions | null
  multiSelectEnabled: boolean
  onResetAction?: (() => void) | null
  onToggleMultiSelectAction: (next: boolean) => void
  search?: TCmsTableSearch | null
  selectedCount: number
  withCategory?: boolean
  withDateRange?: boolean
  withReset?: boolean
  withState?: boolean
  withTags?: boolean
}

export type TCmsSelectColumnFactory = <TRowData>() => ColumnDef<TRowData, unknown>

export type TCmsTableMultiSelect = {
  enabled: boolean
  metaRef: MutableRefObject<MultiSelectionTableMeta>
  selectColumn: TCmsSelectColumnFactory
}

export type TCmsDataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  emptyState?: ReactNode
  getRowIdAction: (row: TData, index?: number) => string
  loading?: boolean
  multiSelect?: TCmsTableMultiSelect | null
  onSortingChangeAction: OnChangeFn<SortingState>
  sorting: SortingState
}

export type TCmsTableControllerOptions = {
  selectColumnAnimationMs?: number
}

export type TCmsTableController = {
  clearSelection: () => void
  metaRef: MutableRefObject<MultiSelectionTableMeta>
  multiSelectEnabled: boolean
  resetFilters: () => void
  searchValue: string
  selectColumn: TCmsSelectColumnFactory
  selectedCount: number
  setSearchValue: (value: string) => void
  setSorting: OnChangeFn<SortingState>
  sorting: SortingState
  toggleMultiSelect: (next: boolean) => void
}
