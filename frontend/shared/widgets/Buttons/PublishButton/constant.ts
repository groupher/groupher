import SVG from '~/const/svg'
import { PUBLISH_MODE } from '~/const/publish'

const POST_MENU_OPTIONS = [
  {
    key: 'feedback',
    icon: SVG.FEATURE,
    title: '功能请求',
  },
  {
    key: 'question',
    icon: SVG.QUESTION,
    title: '问题 / 求助',
  },
  {
    key: 'bug',
    icon: SVG.BUG,
    title: 'Bug / 吐槽',
  },
  {
    key: 'other',
    icon: SVG.MORE,
    title: '其它话题',
  },
]

export const MORE_MENU = {
  [PUBLISH_MODE.DEFAULT]: POST_MENU_OPTIONS,
  [PUBLISH_MODE.SIDEBAR_LAYOUT_HEADER]: POST_MENU_OPTIONS,
  [PUBLISH_MODE.CHANGELOG]: [],
}

export const holder = 1
