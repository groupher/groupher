import { useCallback, useState } from 'react'

export default function useTableSelection() {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const toggleRow = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const toggleAll = useCallback((checked: boolean, ids: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) {
        for (const id of ids) next.add(id)
      } else {
        for (const id of ids) next.delete(id)
      }
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setSelected(new Set())
  }, [])

  const isAllSelected = useCallback(
    (ids: string[]) => ids.length > 0 && ids.every((id) => selected.has(id)),
    [selected],
  )

  const isSomeSelected = useCallback(
    (ids: string[]) => ids.some((id) => selected.has(id)) && !isAllSelected(ids),
    [selected, isAllSelected],
  )

  return {
    selected,
    selectedCount: selected.size,

    toggleRow,
    toggleAll,
    clear,

    isAllSelected,
    isSomeSelected,
  }
}
