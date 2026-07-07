import EVENT from '~/const/event'
import TYPE from '~/const/type'
import type { TArticle, TArticlePubSelector } from '~/spec'

import PubSub from './pubsub'

/**
 * Publish an in-app event message.
 *
 * This is the small event boundary between distant UI surfaces such as drawers,
 * article lists, passport editor, and search panel. Prefer a focused React prop
 * or store action for local state; use `send` when the sender and receiver do
 * not share a direct component owner.
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
 * Broadcasts optimistic upvote state for the currently viewed article.
 */
export const upvoteArticle = (article: TArticle, viewerHasUpvoted): void => {
  send(EVENT.UPVOTE_ARTICLE, { type: 'upvote_article', data: { article, viewerHasUpvoted } })
}

/**
 * Broadcasts a hydrated article payload to surfaces that mirror the viewer's
 * current article state.
 */
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

/**
 * Opens the community passport editor drawer from any toolbar/action surface.
 */
export const callPassportEditor = (): void => {
  const type = TYPE.DRAWER.PASSPORT_EDITOR
  send(EVENT.DRAWER.OPEN, { type })
}

/**
 * Opens the global article editor drawer.
 */
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
