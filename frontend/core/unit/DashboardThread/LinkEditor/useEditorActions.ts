import { useCallback, useMemo, useState } from 'react'

import { CHANGE_MODE } from '~/const/mode'
import type { TChangeMode, TLinkDraftItem, TLinkItem } from '~/spec'

import {
  isDashboardGroupLink,
  isDashboardSingleLink,
  makeDashboardLinkChild,
  makeDashboardLinkGroup,
  makeDashboardSingleLink,
  toDraftLink,
} from './model'
import type { TLinkEditorActions } from './spec'

type TProps = {
  links: readonly TLinkItem[]
  editLinks: (links: readonly TLinkItem[]) => void
  makeId: (prefix: string) => string
  onEditingLinkChange?: (link: TLinkDraftItem | null, mode: TChangeMode) => void
}

export type TDashboardLinkEditorActions = {
  editingLink: TLinkDraftItem | null
  editingLinkMode: TChangeMode
  editingGroup: string | null
  editingGroupIndex: number | null
  collapsedGroups: ReadonlySet<string>
  triggerLinkAdd: () => void
  triggerGroupAdd: () => void
  confirmGroupAdd: () => void
  saveGroup: () => void
  updateEditingGroup: (value: string) => void
  cancelGroupChange: () => void
  add2Group: (groupId: string, groupIndex: number) => void
  add2NewGroup: (title: string, groupIndex: number) => void
  deleteGroup: (index: number) => void
  toggleGroup: (id: string) => void
  triggerGroupUpdate: (title: string, index: number) => void
  confirmGroupUpdate: () => void
  linkActions: TLinkEditorActions
}

export default function useDashboardLinkEditorActions({
  links,
  editLinks,
  makeId,
  onEditingLinkChange,
}: TProps): TDashboardLinkEditorActions {
  const [editingLink, setEditingLink] = useState<TLinkDraftItem | null>(null)
  const [editingLinkMode, setEditingLinkMode] = useState<TChangeMode>(CHANGE_MODE.CREATE)
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [editingGroupIndex, setEditingGroupIndex] = useState<number | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set())

  const setActiveEditingLink = useCallback(
    (link: TLinkDraftItem | null, mode = editingLinkMode): void => {
      setEditingLink(link)
      setEditingLinkMode(mode)
      onEditingLinkChange?.(link, mode)
    },
    [editingLinkMode, onEditingLinkChange],
  )

  const triggerLinkAdd = useCallback((): void => {
    const item = makeDashboardSingleLink(makeId('link'))

    editLinks([...links, item])
    setActiveEditingLink(toDraftLink(item, item.id, links.length, 0), CHANGE_MODE.CREATE)
  }, [editLinks, links, makeId, setActiveEditingLink])

  const triggerGroupAdd = useCallback((): void => {
    setEditingGroup('')
    setEditingGroupIndex(null)
  }, [])

  const cancelGroupChange = useCallback((): void => {
    setEditingGroup(null)
    setEditingGroupIndex(null)
  }, [])

  const updateEditingGroup = useCallback((value: string): void => {
    setEditingGroup(value)
  }, [])

  const confirmGroupAdd = useCallback((): void => {
    if (editingGroup === null) return

    editLinks([...links, makeDashboardLinkGroup(makeId('group'), editingGroup.trim())])
    cancelGroupChange()
  }, [cancelGroupChange, editLinks, editingGroup, links, makeId])

  const confirmGroupUpdate = useCallback((): void => {
    if (editingGroup === null || editingGroupIndex === null) return

    editLinks(
      links.map((item, index) =>
        index === editingGroupIndex && isDashboardGroupLink(item)
          ? { ...item, title: editingGroup.trim() }
          : item,
      ),
    )
    cancelGroupChange()
  }, [cancelGroupChange, editLinks, editingGroup, editingGroupIndex, links])

  const saveGroup = editingGroupIndex === null ? confirmGroupAdd : confirmGroupUpdate

  const triggerGroupUpdate = useCallback((title: string, index: number): void => {
    setEditingGroup(title)
    setEditingGroupIndex(index)
  }, [])

  const add2Group = useCallback(
    (groupId: string, groupIndex: number): void => {
      const child = makeDashboardLinkChild(makeId('child'))
      const group = links.find((item) => item.id === groupId && isDashboardGroupLink(item))

      editLinks(
        links.map((item) =>
          item.id === groupId && isDashboardGroupLink(item)
            ? { ...item, links: [...item.links, child] }
            : item,
        ),
      )
      setActiveEditingLink(
        toDraftLink(
          child,
          groupId,
          groupIndex,
          group && isDashboardGroupLink(group) ? group.links.length : 0,
        ),
        CHANGE_MODE.CREATE,
      )
    },
    [editLinks, links, makeId, setActiveEditingLink],
  )

  const add2NewGroup = useCallback(
    (title: string, groupIndex: number): void => {
      const groupId = makeId('group')
      const child = makeDashboardLinkChild(makeId('child'))
      const group = { ...makeDashboardLinkGroup(groupId, title), links: [child] }

      editLinks([...links, group])
      setActiveEditingLink(toDraftLink(child, groupId, groupIndex, 0), CHANGE_MODE.CREATE)
    },
    [editLinks, links, makeId, setActiveEditingLink],
  )

  const updateEditingLink = useCallback(
    (key: string, value: string): void => {
      if (!editingLink || (key !== 'title' && key !== 'link')) return
      setEditingLink({ ...editingLink, [key]: value })
    },
    [editingLink],
  )

  const updateInGroup = useCallback(
    (linkItem: TLinkDraftItem): void => {
      setActiveEditingLink(linkItem, CHANGE_MODE.UPDATE)
    },
    [setActiveEditingLink],
  )

  const confirmLinkEditing = useCallback(
    (linkItem = editingLink): void => {
      if (!linkItem?.group) return

      editLinks(
        links.map((item) => {
          if (item.id !== linkItem.group) return item

          if (isDashboardSingleLink(item)) {
            return { ...item, title: linkItem.title, url: linkItem.link || '' }
          }

          if (!isDashboardGroupLink(item)) return item

          return {
            ...item,
            links: item.links.map((link, index) =>
              index === linkItem.index
                ? { ...link, title: linkItem.title, url: linkItem.link || '' }
                : link,
            ),
          }
        }),
      )
      setActiveEditingLink(null)
    },
    [editLinks, editingLink, links, setActiveEditingLink],
  )

  const deleteLink = useCallback(
    (linkItem: TLinkDraftItem): void => {
      if (!linkItem.group) return

      editLinks(
        links.flatMap((item) => {
          if (item.id !== linkItem.group) return [item]
          if (isDashboardSingleLink(item)) return []
          if (!isDashboardGroupLink(item)) return [item]

          return [{ ...item, links: item.links.filter((_, index) => index !== linkItem.index) }]
        }),
      )

      if (editingLink?.group === linkItem.group && editingLink.index === linkItem.index) {
        setActiveEditingLink(null)
      }
    },
    [editLinks, editingLink, links, setActiveEditingLink],
  )

  const cancelLinkEditing = useCallback((): void => {
    if (editingLinkMode === CHANGE_MODE.CREATE && editingLink) {
      deleteLink(editingLink)
    }

    setActiveEditingLink(null)
  }, [deleteLink, editingLink, editingLinkMode, setActiveEditingLink])

  const deleteGroup = useCallback(
    (index: number): void => {
      editLinks(links.filter((_, itemIndex) => itemIndex !== index))
    },
    [editLinks, links],
  )

  const toggleGroup = useCallback((id: string): void => {
    setCollapsedGroups((groups) => {
      const next = new Set(groups)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }, [])

  const linkActions = useMemo(
    () => ({
      cancelLinkEditing,
      deleteLink,
      updateEditingLink,
      confirmLinkEditing,
      updateInGroup,
    }),
    [cancelLinkEditing, confirmLinkEditing, deleteLink, updateEditingLink, updateInGroup],
  )

  return {
    editingLink,
    editingLinkMode,
    editingGroup,
    editingGroupIndex,
    collapsedGroups,
    triggerLinkAdd,
    triggerGroupAdd,
    confirmGroupAdd,
    saveGroup,
    updateEditingGroup,
    cancelGroupChange,
    add2Group,
    add2NewGroup,
    deleteGroup,
    toggleGroup,
    triggerGroupUpdate,
    confirmGroupUpdate,
    linkActions,
  }
}
