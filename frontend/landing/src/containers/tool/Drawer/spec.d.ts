import type { TTestable, TActive, TDashboardLayout, TPostLayout, TMetric, TUser } from '~/spec'

export type TStore = {
  visible: boolean
  metric: TMetric

  previousURL: string | null
  previousHomeURL: string | null

  options: TSwipeOption

  swipeDownAviliable: boolean
  swipeUpAviliable: boolean
  canBeClose: boolean
  headerText: string
  showHeaderText: boolean
  disableContentDrag: boolean

  windowWidth: number
  type: string | null
  attUser: TUser | null
  userListerType: string

  mmType: string
  dashboardDescLayout: TDashboardLayout

  commit: (patch: Partial<TStore>) => void
}

export type TSwipeOption = {
  direction: 'bottom' | 'top'
  // inspired by the vim shortcut
  position: 'H' | 'M' | 'L'
}

export type TSwipe = {
  swipeUpY?: number
  swipeDownY?: number
  // options: Record<string, unknown>
  options: TSwipeOption
}

export type TDrawer = TTestable &
  TActive &
  TSwipe & {
    $mobile: boolean
    $rightOffset?: string
    type: string
  } & {
    $fromContentEdge?: boolean
  }

export type TExtraInfo = {
  mmType: string
  userListerType: string
  dashboardDescLayout: TDashboardLayout
  postLayout: TPostLayout
}
