import type { ComponentType } from 'react'

import type {
  DSB_ALIAS_ROUTE,
  DSB_BROADCAST_ROUTE,
  DSB_CHANGELOG_ROUTE,
  DSB_DOC_ROUTE,
  DSB_INFO_ROUTE,
  DSB_APPEARANCE_ROUTE,
  DSB_POST_ROUTE,
  DSB_ROUTE,
  DSB_SEO_ROUTE,
} from '~/const/route'
import type { TConstValues, TTransKey } from '~/spec'

export type TDsbBaseInfoRoute = TConstValues<typeof DSB_INFO_ROUTE>
export type TDsbSEORoute = TConstValues<typeof DSB_SEO_ROUTE>
export type TDsbDocRoute = TConstValues<typeof DSB_DOC_ROUTE>
export type TDsbPostRoute = TConstValues<typeof DSB_POST_ROUTE>
export type TDsbChangelogRoute = TConstValues<typeof DSB_CHANGELOG_ROUTE>
export type TDsbAppearanceRoute = TConstValues<typeof DSB_APPEARANCE_ROUTE>
export type TDsbBroadcastRoute = TConstValues<typeof DSB_BROADCAST_ROUTE>
export type TDsbAliasRoute = TConstValues<typeof DSB_ALIAS_ROUTE>

export type TDsbPath = (typeof DSB_ROUTE)[keyof typeof DSB_ROUTE]

export type TBreadcrumbItem = {
  key?: string
  title: TTransKey
  path: string
  onClick?: () => void
}

type TIconComp = ComponentType<{ className?: string }>

type TDsbCoverItem = {
  title: string
  desc: string
  seg: string
  Icon?: TIconComp

  pinned?: boolean
}

type TDsbCoverGroup = {
  groupTitle: string
  items: TDsbCoverItem[]
}

export type TDsbCoversConfig = {
  title: string
  desc?: React.ReactNode
  items: TDsbCoverGroup[]

  /**
   * Called when user clicks the pin button on a card.
   * The host page owns the state; DsbCovers is purely presentational.
   */
  onTogglePin?: (seg: string, nextPinned: boolean) => void
}
