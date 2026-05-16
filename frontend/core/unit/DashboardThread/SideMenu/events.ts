import { DSB_ROUTE } from '~/const/route'
import type { TDsbChangelogRoute, TDsbDocRoute, TDsbPath, TDsbPostRoute } from '~/spec'

import { MENU_VIEW } from '../constant'

export type TMenuView = (typeof MENU_VIEW)[keyof typeof MENU_VIEW]

export type TMenuViewEvent = {
  changelogSubTab?: TDsbChangelogRoute
  docSubTab?: TDsbDocRoute
  mainTab?: TDsbPath
  postSubTab?: TDsbPostRoute
  returnTo?: string
  view: TMenuView
}

export const DASHBOARD_MENU_VIEW_EVENT = 'dashboard:menu-view'

// Keep the doc return target in the mounted dashboard shell instead of the URL or
// sessionStorage, so Back stays precise without leaking transient UI state.
export const dispatchMenuView = (detail: TMenuViewEvent): void => {
  window.dispatchEvent(new CustomEvent(DASHBOARD_MENU_VIEW_EVENT, { detail }))
}

// Back links can target any dashboard section; derive the main sidebar tab early
// so heavy pages do not leave the old Docs item highlighted while loading.
export const resolveMainTab = (href: string, dashboardBase: string): TDsbPath => {
  const path = href.split('?')[0]

  if (path === dashboardBase) return DSB_ROUTE.OVERVIEW
  if (!path.startsWith(`${dashboardBase}/`)) return DSB_ROUTE.OVERVIEW

  return (path.slice(dashboardBase.length + 1).split('/')[0] || DSB_ROUTE.OVERVIEW) as TDsbPath
}
