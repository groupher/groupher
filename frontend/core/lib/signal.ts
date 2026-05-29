import EVENT from '~/const/event'
import TYPE from '~/const/type'
import type { TArticle, TArticlePubSelector, TToastType } from '~/spec'

import PubSub from './pubsub'

export const toast = (msg: string, type: TToastType = 'info'): void => {
  if (typeof window === 'undefined') return

  if (type === 'error') {
    console.error(msg)
    return
  }

  console.info(msg)
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

export const upvoteArticle = (article: TArticle, viewerHasUpvoted): void => {
  send(EVENT.UPVOTE_ARTICLE, { type: 'upvote_article', data: { article, viewerHasUpvoted } })
}

export const updateViewingArticle = (article: TArticle): void => {
  send(EVENT.UPDATE_VIEWING_ARTICLE, { type: EVENT.UPDATE_VIEWING_ARTICLE, data: { article } })
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

export const callGEditor = (): void => {
  send(EVENT.DRAWER.OPEN, { type: TYPE.DRAWER.G_EDITOR })
}

/**
 * sync selector from publish button to g-editor
 */
export const callSyncSelector = (data: TArticlePubSelector): void => {
  send(EVENT.ARTICLE_SELECTOR, { data })
}

export const authWarn = (option = {}): void => send(EVENT.AUTH_WARNING, option)

/**
 * open search panel
 */
export const openSearch = (): void => {
  const type = TYPE.DRAWER.SEARCH_PANEL

  send(EVENT.DRAWER.OPEN, { type })
}
