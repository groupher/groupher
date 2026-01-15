import type { ComponentType } from 'react'

import type {
  DSB_ALIAS_ROUTE,
  DSB_BROADCAST_ROUTE,
  DSB_DOC_ROUTE,
  DSB_INFO_ROUTE,
  DSB_LAYOUT_ROUTE,
  DSB_ROUTE,
  DSB_SEO_ROUTE,
  DSB_THIRD_PART_ROUTE,
} from '~/const/route'
import type { TConstValues } from '~/spec'

export type TDsbBaseInfoRoute = TConstValues<typeof DSB_INFO_ROUTE>
export type TDsbSEORoute = TConstValues<typeof DSB_SEO_ROUTE>
export type TDsbDocRoute = TConstValues<typeof DSB_DOC_ROUTE>
export type TDsbLayoutRoute = TConstValues<typeof DSB_LAYOUT_ROUTE>
export type TDsbBroadcastRoute = TConstValues<typeof DSB_BROADCAST_ROUTE>
export type TDsbAliasRoute = TConstValues<typeof DSB_ALIAS_ROUTE>
export type TDsbThirdPartRoute = (typeof DSB_THIRD_PART_ROUTE)[keyof typeof DSB_THIRD_PART_ROUTE]

export type TDsbPath = (typeof DSB_ROUTE)[keyof typeof DSB_ROUTE]

export type TPath =
  | 'home'
  | 'post'
  | 'help'
  | 'changelog'
  | 'kanban'
  | 'about'
  | 'user'
  | {
      DASHBOARD: TDsbPath
    }

export type TDsbCrumbItem = {
  title: string
  seg: string
}

export type TBreadcrumbItem = {
  key?: string
  title: string
  path: string
  onClick?: () => void
}

export type TIconComp = ComponentType<{ className?: string }>

export type TDsbCoverItem = {
  title: string
  desc: string
  seg: string
  Icon?: TIconComp

  pinned?: boolean
}

export type TDsbCoverGroup = {
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
