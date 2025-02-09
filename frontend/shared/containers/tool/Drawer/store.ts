// /*
//  * DrawerStore store
//  *
//  */

// import { values, mergeRight, includes } from 'ramda'

// import type { TArticle } from '~/spec'
// import { DASHBOARD_DESC_LAYOUT } from '~/const/layout'
// import { ARTICLE_THREAD } from '~/const/thread'
// import METRIC from '~/const/metric'
// import TYPE from '~/const/type'

// import { lockPage, unlockPage } from '~/dom'
// import { Global } from '~/helper'
// import { mediaBreakPoints } from '~/css/metric'
// import { User } from '~/model'

// import type { TSwipeOption, TExtraInfo } from './spec'
// import { ARTICLE_VIEWER_TYPES, ARTICLE_THREAD_CURD_TYPES } from './constant'
// import { SWIPE_THRESHOLD } from './salon/metrics'

// const defaultOptions: TSwipeOption = { direction: 'bottom', position: 'M' }

// const Options = T.model('Options', {
//   direction: T.opt(T.enum('direction', ['top', 'bottom']), 'bottom'),
//   // like vi-mode
//   position: T.opt(T.enum('position', ['H', 'M', 'L']), 'M'),
// })

// const DrawerStore = T.model('DrawerStore', {
//   visible: T.opt(T.bool, false),
//   metric: T.opt(T.enum(values(METRIC)), METRIC.COMMUNITY),

//   previousURL: T.maybeNull(T.string),
//   // auchor href in case user navi articles in drawers
//   previousHomeURL: T.maybeNull(T.string),
//   // only works for mobile view
//   options: T.opt(Options, defaultOptions),
//   swipeDownAviliable: T.opt(T.bool, true),
//   swipeUpAviliable: T.opt(T.bool, false),
//   canBeClose: T.opt(T.bool, false),
//   headerText: T.opt(T.string, ''),
//   showHeaderText: T.opt(T.bool, false),
//   disableContentDrag: T.opt(T.bool, false),
//   // end of only works for mobile view

//   windowWidth: T.opt(T.number, 1520),
//   type: T.maybeNull(T.enum('previewType', [...values(TYPE.DRAWER), ...ARTICLE_THREAD_CURD_TYPES])),
//   attUser: T.maybeNull(User),
//   userListerType: T.opt(T.string, ''),

//   // shortcut for modelineMenuType
//   mmType: T.opt(T.enum(values(TYPE.MM_TYPE)), TYPE.MM_TYPE.MORE),

//   dashboardDescLayout: T.opt(
//     T.enum(values(DASHBOARD_DESC_LAYOUT)),
//     DASHBOARD_DESC_LAYOUT.POST_LIST,
//   ),
//   // header:
//   // body:
// })
//   .views((self) => ({
//     get optionsData() {
//       return toJS(self.options)
//     },
//     get swipeThreshold() {
//       const { direction, position } = self.options
//       return SWIPE_THRESHOLD[direction][position]
//     },
//     get attUserData() {
//       return toJS(self.attUser)
//     },
//     get modalVisible() {
//       return self.visible && Global.innerWidth > mediaBreakPoints.desktopL
//     },
//     get slideVisible() {
//       return self.visible && Global.innerWidth <= mediaBreakPoints.desktopL
//     },
//     get extraInfo(): TExtraInfo {
//       const slf = self as TStore

//       return {
//         mmType: slf.mmType,
//         userListerType: slf.userListerType,
//         dashboardDescLayout: slf.dashboardDescLayout,
//         postLayout: 'quora',
//       }
//     },
//   }))
//   .actions((self) => ({
//     open({ type, data, options = {} }): void {
//       const slf = self as TStore
//       const thread = data?.meta?.thread?.toLowerCase()
//       const { DRAWER } = TYPE

//       if (type === DRAWER.MODELINE_MENU) {
//         slf.mmType = data
//       }

//       if (includes(thread, values(ARTICLE_THREAD))) {
//         // article
//         slf.setViewing({ [thread]: data, viewingThread: thread })
//       }

//       slf.visible = true
//       slf.type = type

//       slf.options = mergeRight(defaultOptions, options)
//       lockPage()

//       const isMobile = false
//       if (isMobile) {
//         slf.canBeClose = false
//       }

//       if (
//         type !== DRAWER.ACCOUNT_EDIT &&
//         type !== DRAWER.C11N_SETTINGS &&
//         type !== DRAWER.DASHBOARD_DESC &&
//         type !== DRAWER.CUSTOM_BG_EDITOR &&
//         type !== DRAWER.G_EDITOR &&
//         type !== DRAWER.CREATE_TAG &&
//         type !== DRAWER.PASSPORT_EDITOR &&
//         type !== DRAWER.EDIT_TAG &&
//         type !== DRAWER.SEARCH_PANEL &&
//         type !== DRAWER.LIST_USERS
//       ) {
//         // slf.markPreviewURLIfNeed(data)
//       }
//     },
//     setViewing(sobj: Record<string, unknown>): void {
//       console.log('## TODO: setViewing: ', sobj)
//     },
//     close(): void {
//       const slf = self as TStore

//       slf.restorePreviousURLIfNeed()

//       slf.visible = false
//       slf.canBeClose = false
//       slf.type = null

//       unlockPage()
//     },

//     resetViewing(): void {
//       console.log('## TODO: resetViewing')
//     },

//     // if the user has navi article inside the drawer, let's say /post/2 -> /post/3
//     // then after close the drawer, the url should be /topic, not /post/3
//     markPreviewHomeURLIfNeed(): void {
//       if (!self.previousHomeURL) self.previousHomeURL = self.previousURL
//     },

//     markPreviewURLIfNeed(article: TArticle): void {
//       const { innerId, title, meta, originalCommunitySlug } = article

//       if (!innerId || !includes(self.type, ARTICLE_VIEWER_TYPES)) return
//       self.previousURL = Global.location.href

//       const thread = meta.thread.toLowerCase()
//       const nextURL = `${Global.location.origin}/${originalCommunitySlug}/${thread}/${innerId}`

//       // Global.history.replaceState(null, title, nextURL)
//       Global.history.pushState(null, title, nextURL)
//       // console.log('## ## pushing window.location.href: ', nextURL)
//       // Global.history.pushState({ prevUrl: nextURL }, title, nextURL)
//     },

//     restorePreviousURLIfNeed(): void {
//       if (!includes(self.type, ARTICLE_VIEWER_TYPES)) return

//       const targetHref = self.previousHomeURL || self.previousURL

//       // Global.history.replaceState(null, 'new-title', targetHref)
//       // Global.history.pushState(null, 'new-title', targetHref)
//       Global.history.pushState({ prevUrl: targetHref }, 'new-title', targetHref)

//       self.previousHomeURL = null
//     },

//     resetSwipeAviliable(): void {
//       self.swipeDownAviliable = true
//       self.swipeUpAviliable = false
//     },
//     mark(sobj: Record<string, unknown>): void {
//       markStates(sobj, self)
//     },
//   }))

// export type TStore = Instance<typeof DrawerStore>

// export default DrawerStore
