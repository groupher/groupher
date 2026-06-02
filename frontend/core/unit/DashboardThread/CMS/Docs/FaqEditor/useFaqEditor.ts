import { useCallback, useState } from 'react'

import type { TDocFaq } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../../../constant'
import useHelper from '../../../logic/useHelper'
import {
  DEFAULT_GROUP_ID,
  DEFAULT_GROUP_TITLE,
  FAQ_GROUP_MENU_ACTION,
  FAQ_ITEM_MENU_ACTION,
  FAQ_SAVE_ZONE,
  UNTITLED_GROUP_TITLE,
  UNTITLED_ITEM_TITLE,
} from './constant'
import {
  cloneDocFaqTemplate,
  createFaqGroup,
  createFaqItem,
  duplicateFaqItem,
  ensureFlatFaqGroup,
} from './helper'
import { normalizeFaqGroups } from './model'
import type { TFaqEditorGroup, TFaqGroupMenuAction, TFaqItemMenuAction, TFaqSaveZone } from './spec'

type TRet = {
  docFaq: TDocFaq
  saveZone: TFaqSaveZone
  isDocFaqTouched: boolean
  openedItemId: string | null
  addGroup: () => void
  addItem: (groupId?: string) => void
  clearSaveZone: () => void
  handleGroupAction: (groupId: string, action: TFaqGroupMenuAction) => void
  handleItemAction: (groupId: string, itemId: string, action: TFaqItemMenuAction) => void
  renameGroup: (groupId: string, title: string) => void
  renameItem: (groupId: string, itemId: string, title: string) => void
  reorderGroups: (groups: readonly TFaqEditorGroup[]) => void
  setDesc: (desc: string) => void
  setGrouped: (grouped: boolean) => void
  setSaveZone: (zone: TFaqSaveZone) => void
  setTitle: (title: string) => void
  toggleItem: (itemId: string) => void
  updateDetail: (groupId: string, itemId: string, detail: string) => void
}

export default function useFaqEditor(): TRet {
  const dsb$ = useDashboard()
  const { isChanged } = useHelper()
  const [openedItemId, setOpenedItemId] = useState<string | null>(null)
  const docFaq = dsb$.docFaq
  const saveZone = dsb$.docFaqSaveZone
  const isDocFaqTouched = isChanged(FIELD.DOC_FAQ)

  const setSaveZone = useCallback(
    (zone: TFaqSaveZone): void => {
      dsb$.commit({ docFaqSaveZone: zone })
    },
    [dsb$],
  )

  const clearSaveZone = useCallback((): void => {
    dsb$.commit({ docFaqSaveZone: null })
  }, [dsb$])

  const updateFaq = useCallback(
    (nextFaq: TDocFaq): void => {
      dsb$.editField(FIELD.DOC_FAQ, {
        ...nextFaq,
        groups: normalizeFaqGroups(nextFaq.groups),
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

  const setGrouped = useCallback(
    (grouped: boolean): void => {
      if (grouped === docFaq.grouped) return

      const groups = grouped ? docFaq.groups : ensureFlatFaqGroup(docFaq.groups)
      const nextFaq = docFaq.groups.length
        ? { ...docFaq, grouped, groups }
        : cloneDocFaqTemplate(grouped)

      updateFaq(nextFaq)
      setSaveZone({ type: FAQ_SAVE_ZONE.LIST_ORDER })
    },
    [docFaq, setSaveZone, updateFaq],
  )

  const addGroup = useCallback((): void => {
    const group = createFaqGroup()
    updateFaq({ ...docFaq, grouped: true, groups: [...docFaq.groups, group] })
    setSaveZone({ type: FAQ_SAVE_ZONE.GROUP_TITLE, groupId: group.id })
  }, [docFaq, setSaveZone, updateFaq])

  const addItem = useCallback(
    (groupId?: string): void => {
      const targetGroupId = groupId ?? docFaq.groups[0]?.id ?? DEFAULT_GROUP_ID
      const item = createFaqItem()
      const groups = docFaq.groups.length
        ? docFaq.groups
        : [{ id: targetGroupId, title: DEFAULT_GROUP_TITLE, index: 0, items: [] }]

      updateFaq({
        ...docFaq,
        groups: groups.map((group) =>
          group.id === targetGroupId ? { ...group, items: [...group.items, item] } : group,
        ),
      })
      setOpenedItemId(item.id)
      setSaveZone({ type: FAQ_SAVE_ZONE.ITEM_TITLE, groupId: targetGroupId, itemId: item.id })
    },
    [docFaq, setSaveZone, updateFaq],
  )

  const renameGroup = useCallback(
    (groupId: string, title: string): void => {
      updateFaq({
        ...docFaq,
        groups: docFaq.groups.map((group) =>
          group.id === groupId ? { ...group, title: title.trim() || UNTITLED_GROUP_TITLE } : group,
        ),
      })
    },
    [docFaq, updateFaq],
  )

  const renameItem = useCallback(
    (groupId: string, itemId: string, title: string): void => {
      updateFaq({
        ...docFaq,
        groups: docFaq.groups.map((group) =>
          group.id === groupId
            ? {
                ...group,
                items: group.items.map((item) =>
                  item.id === itemId
                    ? { ...item, title: title.trim() || UNTITLED_ITEM_TITLE }
                    : item,
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
      updateFaq({
        ...docFaq,
        groups: docFaq.groups.map((group) =>
          group.id === groupId
            ? {
                ...group,
                items: group.items.map((item) => (item.id === itemId ? { ...item, detail } : item)),
              }
            : group,
        ),
      })
      setSaveZone({ type: FAQ_SAVE_ZONE.ITEM_DETAIL, groupId, itemId })
    },
    [docFaq, setSaveZone, updateFaq],
  )

  const handleGroupAction = useCallback(
    (groupId: string, action: TFaqGroupMenuAction): void => {
      if (action === FAQ_GROUP_MENU_ACTION.ADD) {
        addItem(groupId)
        return
      }

      if (action === FAQ_GROUP_MENU_ACTION.RENAME) {
        setSaveZone({ type: FAQ_SAVE_ZONE.GROUP_TITLE, groupId })
        return
      }

      const nextGroups = docFaq.groups.filter((group) => group.id !== groupId)
      updateFaq({
        ...docFaq,
        groups: nextGroups.length ? nextGroups : cloneDocFaqTemplate(true).groups,
      })
      setSaveZone({ type: FAQ_SAVE_ZONE.LIST_ORDER })
    },
    [addItem, docFaq, setSaveZone, updateFaq],
  )

  const handleItemAction = useCallback(
    (groupId: string, itemId: string, action: TFaqItemMenuAction): void => {
      if (action === FAQ_ITEM_MENU_ACTION.RENAME) {
        setSaveZone({ type: FAQ_SAVE_ZONE.ITEM_TITLE, groupId, itemId })
        return
      }

      updateFaq({
        ...docFaq,
        groups: docFaq.groups.map((group) => {
          if (group.id !== groupId) return group

          if (action === FAQ_ITEM_MENU_ACTION.DELETE) {
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

      if (openedItemId === itemId && action === FAQ_ITEM_MENU_ACTION.DELETE) setOpenedItemId(null)
      setSaveZone({ type: FAQ_SAVE_ZONE.LIST_ORDER })
    },
    [docFaq, openedItemId, setSaveZone, updateFaq],
  )

  const reorderGroups = useCallback(
    (groups: readonly TFaqEditorGroup[]): void => {
      updateFaq({ ...docFaq, groups })
      setSaveZone({ type: FAQ_SAVE_ZONE.LIST_ORDER })
    },
    [docFaq, setSaveZone, updateFaq],
  )

  const toggleItem = useCallback((itemId: string): void => {
    setOpenedItemId((current) => (current === itemId ? null : itemId))
  }, [])

  return {
    docFaq,
    saveZone,
    isDocFaqTouched,
    openedItemId,
    addGroup,
    addItem,
    clearSaveZone,
    handleGroupAction,
    handleItemAction,
    renameGroup,
    renameItem,
    reorderGroups,
    setDesc,
    setGrouped,
    setSaveZone,
    setTitle,
    toggleItem,
    updateDetail,
  }
}
