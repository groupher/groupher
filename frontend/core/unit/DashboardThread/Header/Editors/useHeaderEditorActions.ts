import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useMemo, useState } from 'react'

import { CHANGE_MODE } from '~/const/mode'
import { HEADER_LINK_TYPE } from '~/hooks/useHeaderLinks/constant'
import type { TChangeMode, THeaderLinkItem, TLinkItem } from '~/spec'

import type { TMoveLinkDir } from '../../spec'
import { moveTo, toLinkItem } from './model'

type TProps = {
  links: readonly THeaderLinkItem[]
  onChange: Dispatch<SetStateAction<readonly THeaderLinkItem[]>>
  makeId: (prefix: string) => string
}

type TLinkActions = {
  cancelLinkEditing: () => void
  deleteLink: (linkItem: TLinkItem) => void
  updateEditingLink: (key: string, value: string) => void
  confirmLinkEditing: () => void
  updateInGroup: (linkItem: TLinkItem) => void
}

export type THeaderEditorActions = {
  editingLink: TLinkItem | null
  editingLinkMode: TChangeMode
  editingGroup: string | null
  editingGroupIndex: number | null
  collapsedGroups: ReadonlySet<string>
  saveGroup: () => void
  triggerLinkAdd: () => void
  triggerGroupAdd: () => void
  updateEditingGroup: (value: string) => void
  cancelGroupChange: () => void
  add2Group: (groupId: string, groupIndex: number) => void
  deleteGroup: (index: number) => void
  moveGroup: (from: number, dir: TMoveLinkDir) => void
  toggleGroup: (id: string) => void
  triggerGroupUpdate: (title: string, index: number) => void
  confirmGroupUpdate: () => void
  linkActions: TLinkActions
}

// Owns Header editor form state and mutations. DnD keeps a separate draft hook so
// drag-preview updates do not couple to link/group edit state.
export default function useHeaderEditorActions({
  links,
  makeId,
  onChange,
}: TProps): THeaderEditorActions {
  const [editingLink, setEditingLink] = useState<TLinkItem | null>(null)
  const [editingLinkMode, setEditingLinkMode] = useState<TChangeMode>(CHANGE_MODE.CREATE)
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [editingGroupIndex, setEditingGroupIndex] = useState<number | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set())

  const triggerLinkAdd = useCallback((): void => {
    const item: THeaderLinkItem = {
      id: makeId('link'),
      type: HEADER_LINK_TYPE.LINK,
      title: '',
      url: '',
    }

    onChange((items) => [...items, item])
    setEditingLink(toLinkItem(item, item.id, links.length, 0))
    setEditingLinkMode(CHANGE_MODE.CREATE)
  }, [links.length, makeId, onChange])

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

    const groupId = makeId('group')
    const childId = makeId('child')
    const nextGroup: THeaderLinkItem = {
      id: groupId,
      type: HEADER_LINK_TYPE.GROUP,
      title: editingGroup.trim(),
      links: [{ id: childId, title: '', url: '' }],
    }

    onChange((items) => [...items, nextGroup])
    setEditingLink(toLinkItem(nextGroup.links[0], groupId, links.length, 0))
    setEditingLinkMode(CHANGE_MODE.CREATE)
    cancelGroupChange()
  }, [cancelGroupChange, editingGroup, links.length, makeId, onChange])

  const confirmGroupUpdate = useCallback((): void => {
    if (editingGroup === null || editingGroupIndex === null) return

    onChange((items) =>
      items.map((item, index) =>
        index === editingGroupIndex && item.type === HEADER_LINK_TYPE.GROUP
          ? { ...item, title: editingGroup.trim() }
          : item,
      ),
    )
    cancelGroupChange()
  }, [cancelGroupChange, editingGroup, editingGroupIndex, onChange])

  const saveGroup = editingGroupIndex === null ? confirmGroupAdd : confirmGroupUpdate

  const triggerGroupUpdate = useCallback((title: string, index: number): void => {
    setEditingGroup(title)
    setEditingGroupIndex(index)
  }, [])

  const add2Group = useCallback(
    (groupId: string, groupIndex: number): void => {
      const child = { id: makeId('child'), title: '', url: '' }

      onChange((items) =>
        items.map((item) => {
          if (item.id !== groupId || item.type !== HEADER_LINK_TYPE.GROUP) return item
          return { ...item, links: [...item.links, child] }
        }),
      )

      const group = links.find(
        (item) => item.id === groupId && item.type === HEADER_LINK_TYPE.GROUP,
      )
      setEditingLink(toLinkItem(child, groupId, groupIndex, group?.links.length ?? 0))
      setEditingLinkMode(CHANGE_MODE.CREATE)
    },
    [links, makeId, onChange],
  )

  const updateEditingLink = useCallback(
    (key: string, value: string): void => {
      if (!editingLink || (key !== 'title' && key !== 'link')) return
      setEditingLink({ ...editingLink, [key]: value })
    },
    [editingLink],
  )

  const updateInGroup = useCallback((linkItem: TLinkItem): void => {
    setEditingLink(linkItem)
    setEditingLinkMode(CHANGE_MODE.UPDATE)
  }, [])

  const confirmLinkEditing = useCallback((): void => {
    if (!editingLink?.group) return

    onChange((items) =>
      items.map((item) => {
        if (item.id !== editingLink.group) return item

        if (item.type === HEADER_LINK_TYPE.LINK) {
          return { ...item, title: editingLink.title, url: editingLink.link || '' }
        }

        return {
          ...item,
          links: item.links.map((link, index) =>
            index === editingLink.index
              ? { ...link, title: editingLink.title, url: editingLink.link || '' }
              : link,
          ),
        }
      }),
    )
    setEditingLink(null)
  }, [editingLink, onChange])

  const deleteLink = useCallback(
    (linkItem: TLinkItem): void => {
      if (!linkItem.group) return

      onChange((items) =>
        items.flatMap((item) => {
          if (item.id !== linkItem.group) return [item]
          if (item.type === HEADER_LINK_TYPE.LINK) return []

          return [
            {
              ...item,
              links: item.links.filter((_, index) => index !== linkItem.index),
            },
          ]
        }),
      )

      if (editingLink?.group === linkItem.group && editingLink.index === linkItem.index) {
        setEditingLink(null)
      }
    },
    [editingLink, onChange],
  )

  const cancelLinkEditing = useCallback((): void => {
    if (editingLinkMode === CHANGE_MODE.CREATE && editingLink) {
      deleteLink(editingLink)
    }

    setEditingLink(null)
  }, [deleteLink, editingLink, editingLinkMode])

  const moveGroup = useCallback(
    (from: number, dir: TMoveLinkDir): void => {
      onChange((items) => moveTo(items, from, dir))
    },
    [onChange],
  )

  const deleteGroup = useCallback(
    (index: number): void => {
      onChange((items) => items.filter((_, itemIndex) => itemIndex !== index))
    },
    [onChange],
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
    saveGroup,
    triggerLinkAdd,
    triggerGroupAdd,
    updateEditingGroup,
    cancelGroupChange,
    add2Group,
    deleteGroup,
    moveGroup,
    toggleGroup,
    triggerGroupUpdate,
    confirmGroupUpdate,
    linkActions,
  }
}
