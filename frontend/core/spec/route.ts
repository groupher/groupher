import type {
  DSB_ALIAS_ROUTE,
  DSB_BASEINFO_ROUTE,
  DSB_BROADCAST_ROUTE,
  DSB_DOC_ROUTE,
  DSB_LAYOUT_ROUTE,
  DSB_ROUTE,
  DSB_SEO_ROUTE,
  DSB_THIRD_PART_ROUTE,
} from '~/const/route'
import type { TConstValues } from '~/spec'

export type TDsbBaseInfoRoute = TConstValues<typeof DSB_BASEINFO_ROUTE>
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
