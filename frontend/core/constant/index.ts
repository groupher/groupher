// a.k.a for HOME COMMUNITY NAME

export { default as ACTION } from './action'
export { COMMUNITY_MAP_ALIAS } from './alias'
export { default as C11N } from './c11n'
export { default as EMOTION } from './emotion'
export { default as ERR } from './err'
export { default as EVENT } from './event'
export { default as FILTER } from './filter'
export { default as GALLERY } from './gallery'
export { ARTICLE_CAT, ARTICLE_CAT_MODE, ARTICLE_CAT_REJECT, ARTICLE_STATE } from './gtd'
export { default as GUIDE } from './guide'
export {
  BANNER_LAYOUT,
  BRAND_LAYOUT,
  BROADCAST_LAYOUT,
  CHANGELOG_LAYOUT,
  DOC_FAQ_LAYOUT,
  DOC_LAYOUT,
  DSB_DESC_LAYOUT,
  FOOTER_LAYOUT,
  KANBAN_CARD_LAYOUT,
  POST_LAYOUT,
  TOPBAR_LAYOUT,
  UPVOTE_LAYOUT,
} from './layout'
export { default as METRIC } from './metric'
export { PAYMENT_METHOD, PAYMENT_USAGE } from './payment'
export { default as RECIPE } from './recipe'
export { REPORT, REPORT_TYPE } from './report'
export { DSB_ROUTE, NON_COMMUNITY_ROUTE, ROUTE } from './route'
export { default as SIZE } from './size'
export { default as SVG } from './svg'
export { ARTICLE_THREAD, CARD_THREAD, THREAD } from './thread'
export { default as TYPE } from './type'
export { default as URL_QUERY } from './url_query'
export { default as VIEW } from './view'

export {
  COVER_GRADIENT_WALLPAPER,
  GRADIENT_DIRECTION,
  GRADIENT_WALLPAPER,
  PATTERN_WALLPAPER,
  WALLPAPER,
  WALLPAPER_TYPE,
} from './wallpaper'

/* some svg icon are sensitive to fill color */
/* some community svg need fill color, like city etc.. */

export { COLOR } from './colors'
export { PUBLISH_MODE } from './mode'
export { default as THEME } from './theme'
