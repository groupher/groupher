import { concat, includes, keys, reduce } from 'ramda'

import { ARTICLE_THREAD } from '~/const/thread'
import TYPE from '~/const/type'

const VIEWER_WIDTH = '840px'
const NORMAL_WIDTH = '475px'

const VIEWER_TYPES = reduce(
  concat,
  [TYPE.DRAWER.MAILS_VIEW],
  keys(ARTICLE_THREAD).map((T) => [
    TYPE.DRAWER[`${T}_VIEW`],
    TYPE.DRAWER[`${T}_CREATE`],
    TYPE.DRAWER[`${T}_EDIT`],
  ]),
)

/**
 * viewer-mode is wider, for article viewer, editor staff
 * normal-mode is for settings, user preview staff
 */
export const isWideMode = (type: string): boolean => {
  return (
    includes(type, VIEWER_TYPES) || type === TYPE.DRAWER.DSB_DESC || type === TYPE.DRAWER.G_EDITOR
  )
}

export const getDrawerWidth = (type: string): string => {
  if (type === TYPE.DRAWER.G_EDITOR) return VIEWER_WIDTH

  return isWideMode(type) ? VIEWER_WIDTH : NORMAL_WIDTH
}

export const getDrawerMinWidth = (type: string): string => {
  return isWideMode(type) ? '700px' : '450px'
}

export const getDesktopTransform = (visible: boolean, fromContentEdge: boolean): string => {
  /*
   * 滑动的原理是吧 Drawer 从"屏幕"外面移动到视窗窗口内部，但是在宽屏有背自定义景图片这个设计下，这个滑动
   * 效果实际是从 WIDTH.xxxPAGE 边缘开始的，所以当屏幕宽度大于 maxPage 时，不能用默认的外侧滑动偏移，
   * 需要减小这个值才能感觉自然，否则会有跳动感
   *
   */
  const offsetFromEdge = fromContentEdge ? '65px' : '18px'
  return visible ? 'translate(0px, 0px)' : `translate(${offsetFromEdge}, 0px)` // fromRight
}
