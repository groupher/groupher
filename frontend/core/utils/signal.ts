// eslint-disable-next-line import/no-unresolved
import { toast as hotToast } from 'sonner'
import EVENT from '~/const/event'
import { THREAD } from '~/const/thread'
import TYPE from '~/const/type'
import type {
  TArticle,
  TArticlePubSelector,
  TAttInfo,
  TCommunity,
  TCommunitySetterStyle,
  TGQLError,
  TPaymentUsage,
  TReportType,
  TTag,
  TThread,
  TToastType,
  TWindow,
} from '~/spec'
import BStore from './bstore'
import { scrollToHeader } from './dom'
import PubSub from './pubsub'

export const Global: TWindow = typeof window !== 'undefined' ? window : null

export const toast = (msg: string, type: TToastType = 'info'): void => {
  if (type === 'error') {
    hotToast.error(msg)
    return
  }

  hotToast.success(msg)
}

/**
 * publish event message, 'send' inspired by Elixir
 */
export const send = (msg: string, data = {}): void => {
  // TODO: check the msg is valid
  // PubSub.publishSync(msg, data)
  PubSub.publish(msg, data)
}

/**
 * shortcut for logout
 */
export const logout = (): void => {
  send(EVENT.LOGOUT)
}

/**
 * shortcut for close Drawer
 *
 */
export const closeDrawer = (type = ''): void => send(EVENT.DRAWER.CLOSE, { type })

/**
 * shortcut for call cashier
 *
 */
export const checkout = (amount: number, usage: TPaymentUsage): void =>
  send(EVENT.CALL_CASHIER, { amount, usage })

export const addCollection = (): void => {
  send(EVENT.SET_FAVORITE_CONTENT, {
    data: { thread: THREAD.POST },
  })
}

/**
 * report content
 */
export const report = (type: TReportType, data?: TAttInfo): void => {
  send(EVENT.REPORT, { type, data })
}

export const upvoteArticle = (article: TArticle, viewerHasUpvoted): void => {
  send(EVENT.UPVOTE_ARTICLE, { type: 'upvote_article', data: { article, viewerHasUpvoted } })
}

export const updateViewingArticle = (article: TArticle): void => {
  send(EVENT.UPDATE_VIEWING_ARTICLE, { type: EVENT.UPDATE_VIEWING_ARTICLE, data: { article } })
}

export const refreshArticles = (): void => send(EVENT.REFRESH_ARTICLES)
/**
 * hepler for call the JoinModal Container to show wechatQRCode or mail scriscribe list etc ..
 *
 */
export const joinUS = (type?: string, data = {}): void => {
  send(EVENT.JOIN_US, { type, data })
}

export const moveToCommunity = (): void => {
  send(EVENT.MOVE_TO_COMMUNITY, {})
}

export const mirrorToCommunity = (): void => {
  send(EVENT.MIRROR_TO_COMMUNITY, {})
}

export const setTag = (): void => {
  send(EVENT.SET_TAG, {})
}

/**
 * list users
 * type: modal or drawer
 */
export const listUsers = (type: 'modal' | 'drawer'): void => {
  if (type === 'drawer') {
    const type = TYPE.DRAWER.LIST_USERS
    send(EVENT.DRAWER.OPEN, { type })

    return
  }

  send(EVENT.LIST_USER_MODAL, { type })
}

export const callPassportEditor = (): void => {
  const type = TYPE.DRAWER.PASSPORT_EDITOR
  send(EVENT.DRAWER.OPEN, { type })
}

export const c11nSettings = (): void => {
  send(EVENT.DRAWER.OPEN, { type: TYPE.DRAWER.C11N_SETTINGS })
}

export const callWallpaperEditor = (): void => {
  send(EVENT.DRAWER.OPEN, { type: TYPE.DRAWER.CUSTOM_BG_EDITOR, options: { position: 'H' } })
}

export const callDashboardDesc = (data): void => {
  send(EVENT.DRAWER.OPEN, { type: TYPE.DRAWER.DSB_DESC, data })
}

export const callSubscriber = (): void => {
  send(EVENT.SUBSCRIBE, {})
}

export const callGEditor = (): void => {
  send(EVENT.DRAWER.OPEN, { type: TYPE.DRAWER.G_EDITOR })
}

export const callTagCreateEditor = (): void =>
  send(EVENT.DRAWER.OPEN, { type: TYPE.DRAWER.CREATE_TAG })

export const callTagEditEditor = (): void => send(EVENT.DRAWER.OPEN, { type: TYPE.DRAWER.EDIT_TAG })

export const callAuth = (): void => {
  send(EVENT.AUTH, {})
}

/**
 * sync selector from publish button to g-editor
 */
export const callSyncSelector = (data: TArticlePubSelector): void => {
  send(EVENT.ARTICLE_SELECTOR, { data })
}

export const authWarn = (option = {}): void => send(EVENT.AUTH_WARNING, option)

/**
 * handle click and doubleClick safely
 * see: https://github.com/facebook/react/issues/3185#issuecomment-75138124
 *
 * @param {function} onClick A callback function for single click events
 * @param {function} onDoubleClick A callback function for double click events
                     scroll to header by default
 * @param {number} [latency=300] The amount of time (in milliseconds) to
 *                 wait before differentiating a single from a double click
 * example:
 * before: onClick={() => openMenu(TYPE.MM_TYPE.GLOBAL_MENU)}
 * after:  onClick={multiClick(openMenu(TYPE.MM_TYPE.GLOBAL_MENU))}
 */
export const multiClick = (
  onClick: (HTMLElementEventMap) => void,
  onDoubleClick: (e: HTMLElementEventMap) => void = scrollToHeader,
  latency = 250,
): ((event: HTMLElementEventMap) => void) => {
  let timeoutID = null

  return (event) => {
    if (!timeoutID) {
      timeoutID = setTimeout(() => {
        onClick?.(event)
        timeoutID = null
      }, latency)
    } else {
      timeoutID = clearTimeout(timeoutID)
      onDoubleClick?.(event)
    }
  }
}

/**
 * handle user account state change
 */
export const viewingChanged = (article: TArticle | null): void => {
  if (article) {
    // @ts-expect-error
    BStore.set('viewingArticle', { community: article.communitySlug, id: article.innerId })
  } else {
    BStore.set('viewingArticle', null)
  }
  // see: https://stackoverflow.com/a/55349670/4050784
  Global.dispatchEvent(new Event(EVENT.VIEWING_CHANGED))
}

/**
 * 跳转到某个社区
 * - 如果已经在子社区，只需要重新加载数据
 * - 如果在其他页面，那么需要重新请求页面
 */
export const changeToCommunity = (_slug = ''): void => {
  console.log('## ## changeToCommunity')
}

/**
 * send preview article singal to Drawer
 */
export const previewArticle = (article: TArticle): void => {
  const type = TYPE.DRAWER[`${article.meta.thread}_VIEW`]
  const data = article

  console.log('## previewArticle: ', article)

  send(EVENT.DRAWER.OPEN, { type, data })
}

/**
 * open search panel
 */
export const openSearch = (): void => {
  const type = TYPE.DRAWER.SEARCH_PANEL

  send(EVENT.DRAWER.OPEN, { type })
}

export const setArticleTag = (community: TCommunity, thread: TThread, tags: TTag[]): void => {
  if (!community.id) {
    console.error('should set community for tag setter')
    return
  }
  send(EVENT.SET_TAG, { community, thread, tags })
}

export const selectCommunity = (communityStyle?: TCommunitySetterStyle): void => {
  send(EVENT.SELECT_COMMUNITY, { communityStyle })
}

export const errRescue = ({ type, operation, details, path }: TGQLError): void => {
  send(EVENT.ERR_RESCUE, { type, data: { operation, details, path } })
}
