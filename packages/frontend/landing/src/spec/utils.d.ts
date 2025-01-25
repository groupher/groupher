import type { ReactNode, ChangeEvent } from 'react'
// c# like
export type Nullable<T> = T | null

export type TID = string

export type TView = 'desktop' | 'mobile' | 'modeline' | 'drawer'

export type TPagi = {
  pageNumber?: number
  pageSize?: number
  totalCount?: number
  totalPages?: number
}

export type TTestable = {
  testid?: string
  $testid?: string
  'data-test-id'?: string
}

export type TActive = {
  active?: boolean
  $active?: boolean
  show?: boolean
  $show?: boolean
  visible?: boolean
  $visible?: boolean
}

export type TSpace = {
  top?: number | 'px'
  bottom?: number | 'px'
  left?: number | 'px'
  right?: number | 'px'
}

// google analytis format
export type TGAEvent = {
  action: string
  category: string
  label: string
  value: string
}

export type TLink = {
  href: string
}

export type TPlatform = {
  isChrome: boolean
  isFirefox: boolean
  isSafari: boolean
  isIE: boolean
  isEdge: boolean
  isMacOS: boolean
  isMobile: boolean
}

export type TDirection = 'down' | 'up'
export type TScrollDirection = 'up' | 'down'

export type TTooltipAnimation = 'shift-away' | 'shift-toward' | 'fade' | 'scale' | 'perspective'

export type TTooltipPlacement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end'
  | 'right'
  | 'right-start'
  | 'right-end'

export type TReportType = 'ARTICLE' | 'USER' | 'COMMENT' | 'COMMUNITY'

export type TAttInfo = {
  id: string
  title: string
  // ...
}

export type TTabItem = {
  id?: string
  title?: string
  slug: string
  alias?: string
  icon?: string | ReactNode
  localIcon?: string
}

export type TResState = 'LOADING' | 'DONE' | 'EMPTY'

export type TPaymentUsage = 'SENIOR' | 'GIRLS_CODE_TOO_PLAN' | 'DONATE' | 'SPONSOR'
export type TPaymentMethod = 'ALIPAY' | 'WECHAT'

export type TFlexRule =
  | 'align-both'
  | 'align-center'
  | 'align-start'
  | 'align-end'
  | 'align-baseline'
  | 'justify-center'
  | 'justify-start'
  | 'justify-end'
  | 'justify-between'
  | 'justify-around'
  | 'justify-evenly'
  | ''

export type TGQError = {
  message?: string
  key?: string
  path?: string
  code?: number
}

export type TInput = (Event & { target: HTMLInputElement }) | ChangeEvent<HTMLInputElement>
export type TEditValue = TInput | string | boolean | string[] | number

export type TEditMode = 'publish' | 'update'

export type TSubmitState = {
  publishing?: boolean
  publishDone?: boolean
  isReady?: boolean
  isArchived?: boolean
  isArticleAuthor?: boolean
  mode?: TEditMode
}

export type TSelectOption = {
  value: string
  label: string
  icon?: ReactNode
  desc?: string
}

export type TCityOption = TSelectOption & {
  flag?: string
}

export type TTechStackCategory = 'lang' | 'framework' | 'database' | 'devOps' | 'design'

export type TCommunitySetterStyle = 'normal' | TTechStackCategory

export type TUserActivity = {
  id?: TID
  insertedAt?: string
  articleTitle?: string
  digest?: string
  action?: string
  totalCount?: number
}

export type TOnlineStatus = {
  totalSubscribes?: number
  realtimeVisitors?: number
}

// modeline

export type TModelineType =
  | 'global_menu'
  | 'community'
  | 'filter'
  | 'discover'
  | 'publish'
  | 'share'
  | 'report'
  | 'collect'
  | 'search'
  | 'more'

// for menu button
export type TMenuOption = {
  title: string
  key: string
  icon?: string
  link?: string
  qrLink?: string
}

export type TToastType = 'info' | 'error' | 'success'

export type TPublishMode = 'default' | 'changelog' | 'help' | 'sidebar_layout_header'

export type TDashboardLayout = 'post_list' | 'banner' | 'changelog_list'

export type TSocialType =
  | 'EMAIL'
  | 'WECHAT'
  | 'TWITTER'
  | 'WEIBO'
  | 'ZHIHU'
  | 'GITHUB'
  | 'BILIBILI'
  | 'BOSS'
  | 'TIKTOK'

export type TSocialItem = {
  type: TSocialType
  link: string
}

export type TSocial = {
  title: string
  slug: string
}

export type TLinkItem = {
  index: number
  title: string
  link?: string
  group?: string
  groupIndex?: number
}

export type TGroupedLinks = {
  [key: string]: TLinkItem[]
}

export type TChangeMode = 'create' | 'update'

export type TUploadPreview = {
  height: number
  width: number
  radius: number
}

export type TConditionMode = 'state' | 'cat' | 'order' | 'tag'
export type TWidgetType = 'sidebar' | 'modal' | 'popup' | 'iframe' | 'link'

export type TButtonPrefix = 'sort' | 'catetory' | 'status'
