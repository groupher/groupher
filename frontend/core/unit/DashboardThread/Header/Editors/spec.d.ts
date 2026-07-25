import type { TConstValues, TLinkChild } from '~/spec'

import type { HEADER_COLUMN_TYPE } from './constants'

export type THeaderColumnType = TConstValues<typeof HEADER_COLUMN_TYPE>

export type THeaderColumn = {
  id: string
  type: THeaderColumnType
  title: string
  sourceIndex: number
  links: TLinkChild[]
  fixedLinks: TLinkChild[]
}

export type THeaderDragTarget = {
  columnId?: string
  itemId?: string
  position?: 'before' | 'after'
}
