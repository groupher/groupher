import { ANCHOR, BODY_SCROLLER, DRAWER_SCROLLER } from '~/const/dom'
import type { TContainer } from '~/spec'

// side effects, need refactor
const hasDocument = typeof document === 'object' && document !== null
const hasWindow = typeof window === 'object' && window !== null && window.self === window
let pageLockCount = 0
let pageLockBodyStyleSnapshot: {
  overflow: string
  overflowY: string
} | null = null

/**
 * check is client side or not
 */
const isBrowser = (): boolean => hasDocument && hasWindow
const getDocument = () => (isBrowser() ? document : null)

/**
 * scroll to an element on page
 * https://github.com/KingSora/OverlayScrollbars/issues/100
 */
export const scrollIntoEle = (eleID: string): void => {
  if (typeof window === 'object') {
    const el = document.getElementById(eleID)
    // el?.scrollIntoView({ behavior: 'smooth' })
    el?.scrollIntoView()
  }
}

export const scrollToHeader = (): void => scrollIntoEle(ANCHOR.GLOBAL_CLASSIC_ID)

export const scrollDrawerToTop = (): void => {
  if (typeof window !== 'object') return

  const container = document.querySelector<HTMLElement>('[data-drawer-scroll-container]')

  if (container) {
    container.scrollTop = 0
    return
  }

  scrollIntoEle(ANCHOR.DRAWER_HEAD)
}

export const scrollToComments = (view: TContainer = 'body'): void => {
  if (typeof window === 'object') {
    const scroller = view === 'body' ? window[BODY_SCROLLER] : window[DRAWER_SCROLLER]
    const el = document.getElementById(ANCHOR.COMMENTS_ID)

    scroller?.scroll(el, 500)
  }
}
/**
 * froze page's body element
 * @returns {void}
 */
export const lockPage = (): void => {
  const safeDocument = getDocument()
  if (!safeDocument) return

  pageLockCount += 1
  if (pageLockCount > 1) return

  const el = safeDocument.getElementsByTagName('body')[0]
  pageLockBodyStyleSnapshot = {
    overflow: el.style.overflow,
    overflowY: el.style.overflowY,
  }

  el.style.overflow = 'hidden'
  el.style.overflowY = 'hidden'
}

/**
 * unfroze page's body element
 * @returns {void}
 */
export const unlockPage = (): void => {
  const safeDocument = getDocument()
  if (!safeDocument) return
  if (pageLockCount <= 0) return

  pageLockCount -= 1
  if (pageLockCount > 0) return

  const el = safeDocument.getElementsByTagName('body')[0]

  if (pageLockBodyStyleSnapshot) {
    el.style.overflow = pageLockBodyStyleSnapshot.overflow
    el.style.overflowY = pageLockBodyStyleSnapshot.overflowY
  } else {
    el.style.overflow = ''
    el.style.overflowY = ''
  }

  pageLockBodyStyleSnapshot = null
}

/**
 * toggle global blurable elements, and lock page
 * 注意不能全局 blur 根元素，会和 position: fixed 冲突
 * @see @link https://stackoverflow.com/questions/52937708/css-filter-on-parent-breaks-child-positioning
 *
 * @param {Boolean} visible
 */
export const toggleGlobalBlur = (visible: boolean): void => {
  const blurableEls = document.querySelectorAll(`.${ANCHOR.GLOBAL_BLUR_CLASS}`)

  if (blurableEls) {
    for (let index = 0; index < blurableEls.length; index += 1) {
      const el = blurableEls[index] as HTMLElement

      if (!visible) {
        el.style.filter = ''
      } else {
        el.style.filter = 'brightness(0.6)'
      }
    }
  }
}

/**
 * only judge verticle
 * under the CustomScroller, the trandition inViewport method is not work
 * NOTE:  在 CustomScroller 的情况下，传统的判断 inViewport 的方法行不通
 * 只需简单判断当前 el 的高度和已经滑动的距离即可
 */
export const isElementInViewport = (el: HTMLElement): boolean => {
  if (!el) return false
  const rect = el.getBoundingClientRect()

  return rect.height + rect.y > 0
}
/* eslint-enable no-undef */

/**
 * add pixed by number
 *
 * e.g:
 * pixelAdd('20px', 10) => 30px
 */
export const pixelAdd = (current: string, num: number): string => {
  if (!current) return '0'

  const pixelNum = Number(current.slice(0, -2))

  return `${pixelNum + num}px`
}
