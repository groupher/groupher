import type { TDocFaqSaveZone } from '~/stores/dashboard/spec'

import type { TLinkDndTarget } from '../../../LinkEditor/Dnd/spec'

export type TFaqEditorItem = {
  id: string
  title: string
  detail: string
  index: number
}

export type TFaqEditorGroup = {
  id: string
  title: string
  index: number
  items: readonly TFaqEditorItem[]
}

export type TFaqEditingTarget =
  | { type: 'group'; groupId: string }
  | { type: 'item'; groupId: string; itemId: string }
  | null

export type TFaqGroupMenuAction = 'add' | 'rename' | 'delete'
export type TFaqItemMenuAction = 'rename' | 'duplicate' | 'delete'
export type TFaqDragTarget = TLinkDndTarget
export type TFaqSaveZone = TDocFaqSaveZone
