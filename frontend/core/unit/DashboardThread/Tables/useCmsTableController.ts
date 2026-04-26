'use client'

import type { SortingState } from '@tanstack/react-table'
import { startTransition, useCallback, useEffect, useState } from 'react'

import { useMultiSelection } from '~/hooks/useTanTable'

import type { TCmsTableController, TCmsTableControllerOptions } from './types'

const DEFAULT_SELECT_COLUMN_ANIMATION_MS = 200

export default function useCmsTableController(
  options?: TCmsTableControllerOptions,
): TCmsTableController {
  const selectColumnAnimationMs =
    options?.selectColumnAnimationMs ?? DEFAULT_SELECT_COLUMN_ANIMATION_MS

  const [sorting, setSorting] = useState<SortingState>([])
  const [multiSelectEnabled, setMultiSelectEnabled] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const { metaRef, selectColumn, selectedCount, clear } = useMultiSelection()

  useEffect(() => {
    if (multiSelectEnabled || selectedCount === 0) return

    const timer = window.setTimeout(() => {
      clear()
    }, selectColumnAnimationMs)

    return () => window.clearTimeout(timer)
  }, [multiSelectEnabled, selectedCount, clear, selectColumnAnimationMs])

  const toggleMultiSelect = useCallback((next: boolean) => {
    startTransition(() => {
      setMultiSelectEnabled(next)
    })
  }, [])

  const resetFilters = useCallback(() => {
    setSearchValue('')
  }, [])

  return {
    clearSelection: clear,
    metaRef,
    multiSelectEnabled,
    resetFilters,
    searchValue,
    selectColumn,
    selectedCount,
    setSearchValue,
    setSorting,
    sorting,
    toggleMultiSelect,
  }
}
