import type { ReactNode } from 'react'

import type { TChangeMode, TLinkDraftItem } from '~/spec'

export type TLinkEditorActions = {
  cancelLinkEditing: () => void
  deleteLink: (linkItem: TLinkDraftItem) => void
  updateEditingLink: (key: string, value: string) => void
  confirmLinkEditing: (linkItem?: TLinkDraftItem) => void
  updateInGroup: (linkItem: TLinkDraftItem) => void
}

export type TLinkEditorProps = {
  notifyText?: string
  linkItem?: TLinkDraftItem
  editingLink?: TLinkDraftItem
  mode?: TChangeMode
  disableSetting?: boolean
  disableEdit?: boolean
  compact?: boolean
  actions: TLinkEditorActions
}

export type TGroupInputerProps = {
  value: string
  onChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}

export type TDeleteMenuProps = {
  onDelete?: () => void
}

export type TGroupHeadProps = {
  title: string
  currentIndex: number
  collapsed?: boolean
  editingGroup: string | null
  editingGroupIndex: number | null
  dragHandle?: ReactNode
  onToggle?: () => void
  onEdit?: (title: string, index: number) => void
  onDelete?: () => void
  onCancelEdit: () => void
  onChangeEdit: (value: string) => void
  onConfirmEdit: () => void
}

export type TLinksHintProps = {
  count: number
  empty?: boolean
}
