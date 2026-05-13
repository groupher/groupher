import type { TConstValues, TLinkChild } from '~/spec'

import type { HEADER_COLUMN_KIND } from './constants'

export type THeaderColumnKind = TConstValues<typeof HEADER_COLUMN_KIND>

export type THeaderColumn = {
  id: string
  kind: THeaderColumnKind
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
