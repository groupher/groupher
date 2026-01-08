import { COLOR_NAME } from '~/const/colors'

export const ONE_LINK_GROUP = '__ONE_LINK_GROUP__'
export const MORE_GROUP = '__MORE_GROUP__'

export const INIT_KANBAN_COLORS = [COLOR_NAME.BLACK, COLOR_NAME.BLACK, COLOR_NAME.BLACK]

export const DEFAULT_ENABLE = {
  post: true,
  kanban: true,
  changelog: true,
  //
  doc: true,
  docLastUpdate: true,
  docReaction: true,
  //
  about: true,
  aboutTechstack: true,
  aboutLocation: true,
  aboutLinks: true,
  aboutMediaReport: true,
}

export const WIDGET_TYPE = {
  SIDEBAR: 'sidebar',
  MODAL: 'modal',
  POPUP: 'popup',
  IFRAME: 'iframe',
  LINK: 'link',
} as const

export const TW_CARD = {
  SUMMARY: 'summary',
  SUMMARY_LARGE_IMAGE: 'summary_large_image',
}

export const DSB = {
  // all options
}
