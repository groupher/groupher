'use client'

import { useCallback } from 'react'

import type { TDocFaq, TDocFaqGroup } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'
import type { TDocFaqSaveZone } from '~/stores/dashboard/spec'

import {
  DEFAULT_GROUP_ID,
  DOC_FAQ_FIELD,
  DOC_FAQ_ITEM_ACTION,
  DOC_FAQ_SAVE_ZONE,
  UNTITLED_GROUP_TITLE,
  UNTITLED_ITEM_TITLE,
} from './constant'
import {
  cloneDocFaqTemplate,
  createFaqGroup,
  createFaqItem,
  duplicateFaqItem,
  normalizeDocFaq,
  sameDocFaq,
} from './model'

type TRet = {
  addGroup: () => void
  addItem: (groupId?: string) => string
  clearSaveZone: () => void
  deleteGroup: (groupId: string) => void
  handleItemAction: (groupId: string, itemId: string, action: TDocFaqItemAction) => void
  renameGroup: (groupId: string, title: string) => void
  renameItem: (groupId: string, itemId: string, title: string) => void
  reorderGroups: (groups: readonly TDocFaqGroup[]) => void
  setDesc: (desc: string) => void
  setGroupedView: (groupedView: boolean) => void
  setSaveZone: (zone: TDocFaqSaveZone) => void
  setTitle: (title: string) => void
  updateDetail: (groupId: string, itemId: string, detail: string) => void
}

type TDocFaqItemAction = (typeof DOC_FAQ_ITEM_ACTION)[keyof typeof DOC_FAQ_ITEM_ACTION]

/**
 * Mutations for the dashboard FAQ draft.
 *
 * These actions are the single place that updates `docFaq`, touches the
 * dashboard field, and assigns the save zone used by SavingBar.
 */
export default function useDocFaqActions(): TRet {
  const dsb$ = useDashboard()
  const docFaq = dsb$.docFaq

  const setSaveZone = useCallback(
    (zone: TDocFaqSaveZone): void => {
      dsb$.commit({ docFaqSaveZone: zone })
    },
    [dsb$],
  )

  const clearSaveZone = useCallback((): void => {
    dsb$.commit({ docFaqSaveZone: null })
  }, [dsb$])

  const updateFaq = useCallback(
    (nextFaq: TDocFaq): void => {
      dsb$.editField(DOC_FAQ_FIELD, normalizeDocFaq(nextFaq))
    },
    [dsb$],
  )

  const updateFaqWithSaveZone = useCallback(
    (nextFaq: TDocFaq, zone: Exclude<TDocFaqSaveZone, null>): void => {
      const normalizedFaq = normalizeDocFaq(nextFaq)
      dsb$.editField(DOC_FAQ_FIELD, normalizedFaq)
      dsb$.commit({
        docFaqSaveZone: sameDocFaq(normalizedFaq, dsb$.original.docFaq) ? null : zone,
      })
    },
    [dsb$],
  )

  const setTitle = useCallback(
    (title: string): void => updateFaq({ ...docFaq, title }),
    [docFaq, updateFaq],
  )

  const setDesc = useCallback(
    (desc: string): void => updateFaq({ ...docFaq, desc }),
    [docFaq, updateFaq],
  )

  const setGroupedView = useCallback(
    (groupedView: boolean): void => {
      if (groupedView === docFaq.groupedView) return

      updateFaqWithSaveZone({ ...docFaq, groupedView }, { type: DOC_FAQ_SAVE_ZONE.MODE })
    },
    [docFaq, updateFaqWithSaveZone],
  )

  const addGroup = useCallback((): void => {
    const group = createFaqGroup()
    updateFaq({ ...docFaq, groupedView: true, groupItems: [...docFaq.groupItems, group] })
    setSaveZone({ type: DOC_FAQ_SAVE_ZONE.GROUP_TITLE, groupId: group.id })
  }, [docFaq, setSaveZone, updateFaq])

  const addItem = useCallback(
    (groupId?: string): string => {
      const item = createFaqItem()
      let targetGroupId = groupId ?? DEFAULT_GROUP_ID

      if (docFaq.groupedView) {
        const groupItems = docFaq.groupItems.length
          ? docFaq.groupItems
          : cloneDocFaqTemplate().groupItems
        targetGroupId = groupId ?? groupItems[0]?.id ?? DEFAULT_GROUP_ID

        updateFaq({
          ...docFaq,
          groupItems: groupItems.map((group) =>
            group.id === targetGroupId ? { ...group, items: [...group.items, item] } : group,
          ),
        })
      } else {
        updateFaq({ ...docFaq, flatItems: [...docFaq.flatItems, item] })
      }

      setSaveZone({
        type: DOC_FAQ_SAVE_ZONE.ITEM_TITLE,
        groupId: docFaq.groupedView ? targetGroupId : DEFAULT_GROUP_ID,
        itemId: item.id,
      })

      return item.id
    },
    [docFaq, setSaveZone, updateFaq],
  )

  const renameGroup = useCallback(
    (groupId: string, title: string): void => {
      updateFaq({
        ...docFaq,
        groupItems: docFaq.groupItems.map((group) =>
          group.id === groupId ? { ...group, title: title.trim() || UNTITLED_GROUP_TITLE } : group,
        ),
      })
    },
    [docFaq, updateFaq],
  )

  const renameItem = useCallback(
    (groupId: string, itemId: string, title: string): void => {
      const normalizedTitle = title.trim() || UNTITLED_ITEM_TITLE

      if (!docFaq.groupedView) {
        updateFaq({
          ...docFaq,
          flatItems: docFaq.flatItems.map((item) =>
            item.id === itemId ? { ...item, title: normalizedTitle } : item,
          ),
        })
        return
      }

      updateFaq({
        ...docFaq,
        groupItems: docFaq.groupItems.map((group) =>
          group.id === groupId
            ? {
                ...group,
                items: group.items.map((item) =>
                  item.id === itemId ? { ...item, title: normalizedTitle } : item,
                ),
              }
            : group,
        ),
      })
    },
    [docFaq, updateFaq],
  )

  const updateDetail = useCallback(
    (groupId: string, itemId: string, detail: string): void => {
      if (!docFaq.groupedView) {
        updateFaq({
          ...docFaq,
          flatItems: docFaq.flatItems.map((item) =>
            item.id === itemId ? { ...item, detail } : item,
          ),
        })
      } else {
        updateFaq({
          ...docFaq,
          groupItems: docFaq.groupItems.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  items: group.items.map((item) =>
                    item.id === itemId ? { ...item, detail } : item,
                  ),
                }
              : group,
          ),
        })
      }

      setSaveZone({ type: DOC_FAQ_SAVE_ZONE.ITEM_DETAIL, groupId, itemId })
    },
    [docFaq, setSaveZone, updateFaq],
  )

  const deleteGroup = useCallback(
    (groupId: string): void => {
      const nextGroups = docFaq.groupItems.filter((group) => group.id !== groupId)
      updateFaq({
        ...docFaq,
        groupItems: nextGroups.length ? nextGroups : cloneDocFaqTemplate().groupItems,
      })
      setSaveZone({ type: DOC_FAQ_SAVE_ZONE.LIST_ORDER })
    },
    [docFaq, setSaveZone, updateFaq],
  )

  const handleItemAction = useCallback(
    (groupId: string, itemId: string, action: TDocFaqItemAction): void => {
      if (action === DOC_FAQ_ITEM_ACTION.RENAME) {
        setSaveZone({ type: DOC_FAQ_SAVE_ZONE.ITEM_TITLE, groupId, itemId })
        return
      }

      if (!docFaq.groupedView) {
        if (action === DOC_FAQ_ITEM_ACTION.DELETE) {
          updateFaq({
            ...docFaq,
            flatItems: docFaq.flatItems.filter((item) => item.id !== itemId),
          })
        } else {
          const itemIndex = docFaq.flatItems.findIndex((item) => item.id === itemId)
          const item = docFaq.flatItems[itemIndex]
          if (item) {
            const flatItems = [...docFaq.flatItems]
            flatItems.splice(itemIndex + 1, 0, duplicateFaqItem(item))
            updateFaq({ ...docFaq, flatItems })
          }
        }
      } else {
        updateFaq({
          ...docFaq,
          groupItems: docFaq.groupItems.map((group) => {
            if (group.id !== groupId) return group

            if (action === DOC_FAQ_ITEM_ACTION.DELETE) {
              return { ...group, items: group.items.filter((item) => item.id !== itemId) }
            }

            const itemIndex = group.items.findIndex((item) => item.id === itemId)
            const item = group.items[itemIndex]
            if (!item) return group

            const items = [...group.items]
            items.splice(itemIndex + 1, 0, duplicateFaqItem(item))
            return { ...group, items }
          }),
        })
      }

      setSaveZone({ type: DOC_FAQ_SAVE_ZONE.LIST_ORDER })
    },
    [docFaq, setSaveZone, updateFaq],
  )

  const reorderGroups = useCallback(
    (groups: readonly TDocFaqGroup[]): void => {
      const nextFaq = docFaq.groupedView
        ? { ...docFaq, groupItems: groups }
        : { ...docFaq, flatItems: groups[0]?.items ?? [] }

      updateFaq(nextFaq)
      setSaveZone({ type: DOC_FAQ_SAVE_ZONE.LIST_ORDER })
    },
    [docFaq, setSaveZone, updateFaq],
  )

  return {
    addGroup,
    addItem,
    clearSaveZone,
    deleteGroup,
    handleItemAction,
    renameGroup,
    renameItem,
    reorderGroups,
    setDesc,
    setGroupedView,
    setSaveZone,
    setTitle,
    updateDetail,
  }
}
