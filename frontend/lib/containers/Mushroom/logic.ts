// import { type ReactNode, useEffect, Children, isValidElement, cloneElement } from 'react'

// import { APP_VERSION } from '~/config'
// import type { TScrollDirection, TArticle, TResState } from '~/spec'
// import EVENT from '~/const/event'
// import TYPE from '~/const/type'
// import ERR from '~/const/err'

// import { errRescue } from '~/signal'
// import { Global } from '~/helper'

// import { matchArticleUpvotes } from '~/utils/macros'
// //import { scrollToTop } from '~/dom'
// import asyncSuit from '~/async'

// import S from './schema'
// // import type { TStore } from './store'

// let store: undefined
// let sub$ = null

// const { SR71, $solver, asyncRes, asyncErr } = asyncSuit
// const sr71$ = new SR71({
//   // @ts-ignore
//   receive: [
//     EVENT.UPVOTE_ARTICLE,
//     EVENT.UPDATE_VIEWING_ARTICLE,
//     EVENT.REFRESH_ARTICLES,
//     EVENT.LIST_USER_MODAL,
//   ],
// })

// // custromScroll's scroll direction change
// export const onPageScrollDirhange = (bodyScrollDirection: TScrollDirection): void =>
//   store.mark({ bodyScrollDirection })

// export const clearDemoSetting = () => store.clearLocalSettings()

// // cloning children with new props
// // see detail: https://stackoverflow.com/questions/32370994/how-to-pass-props-to-this-props-children
// export const childrenWithProps = (
//   children: ReactNode,
//   props: Record<string, unknown>,
// ): ReactNode => {
//   return Children.map(children, (child) => {
//     // checking isValidElement is the safe way and avoids a typescript error too
//     if (isValidElement(child)) {
//       return cloneElement(child, { ...props })
//     }
//     return child
//   })
// }

// /**
//  * set appVersion to window from package.json
//  * @link https://stackoverflow.com/a/67701490/4050784
//  */
// const initAppVersion = (): void => {
//   Global.appVersion = APP_VERSION || 'unknow'
// }

// const loadArticles = (page = 1): void => {
//   console.log('## TODO: load loadArticles: ', page)
//   // const { curCommunity, userHasLogin, activeTag, activeCat, activeState, activeOrder } = store
//   // store.updateResState(TYPE.RES_STATE.LOADING as TResState)
//   // scrollToTop()

//   // const filter = { page, size: 20, community: curCommunity.slug } as TPagedArticlesParams

//   // if (activeTag?.slug) filter.articleTag = activeTag?.slug

//   // if (activeCat) filter.cat = activeCat
//   // if (activeState) filter.state = activeState
//   // if (activeOrder) filter.order = activeOrder

//   // sr71$.query(S.pagedPosts, { filter, userHasLogin })
// }

// // TODO: use sanitor to filter whitelist oueries if nend
// const syncURL = (page: number): void => {
//   console.log('## TODO: syncURL: ', page)
//   // const { activeTag, activeCat, activeState, activeOrder } = store
//   // const curSearchParams = getCurSearchParams()

//   // // handle tag spec logic
//   // activeTag?.slug ? (curSearchParams.tag = activeTag?.slug) : delete curSearchParams.tag
//   // activeCat ? (curSearchParams.cat = activeCat.toLowerCase()) : delete curSearchParams.cat
//   // activeState ? (curSearchParams.state = activeState.toLowerCase()) : delete curSearchParams.state
//   // activeOrder ? (curSearchParams.order = activeOrder.toLowerCase()) : delete curSearchParams.order

//   // // handle page number spec logic
//   // page !== 1 ? (curSearchParams.page = page) : delete curSearchParams.page

//   // doSyncRoute(searchParams2String(curSearchParams))
// }

// export const searchParams2String = (obj): string => new URLSearchParams(obj).toString()

// // biome-ignore lint/suspicious/noExplicitAny: <explanation>
// export const getCurSearchParams = (): Record<any, any> =>
//   Object.fromEntries(new URLSearchParams(window.location.search))

// export const doSyncRoute = (queryString: string): void => {
//   const { curCommunity, curThread } = store
//   const mainPath = `/${curCommunity.slug}/${curThread}`

//   if (!queryString) {
//     Global.history.pushState(null, '', `${mainPath}`)
//     return
//   }

//   Global.history.pushState(null, '', `${mainPath}?${queryString}`)
// }

// // ###############################
// // init & uninit
// // ###############################
// export const handleUpvote = (article: TArticle, viewerHasUpvoted: boolean): void => {
//   const { id, meta } = article

//   store.setViewingAlways(article)
//   store.updateViewerHasUpvoted(viewerHasUpvoted)
//   const queryLatestUsers = true

//   viewerHasUpvoted
//     ? sr71$.mutate(S.getUpvote(meta.thread, queryLatestUsers), { id })
//     : sr71$.mutate(S.getUndoUpvote(meta.thread, queryLatestUsers), { id })
// }

// const handleUovoteRes = ({ upvotesCount, meta }) => {
//   store.syncUploadInfo(upvotesCount, meta)
// }

// const DataSolver = [
//   ...matchArticleUpvotes(handleUovoteRes),
//   {
//     match: asyncRes(EVENT.REFRESH_ARTICLES),
//     action: (data) => {
//       const { page } = data[EVENT.REFRESH_ARTICLES]
//       loadArticles(page)
//     },
//   },
//   {
//     match: asyncRes('pagedPosts'),
//     action: (res) => {
//       store.updateResState(TYPE.RES_STATE.DONE as TResState)
//       store.updatePagedArticles(res.pagedPosts)

//       syncURL(res.pagedPosts.pageNumber)
//     },
//   },
//   {
//     match: asyncRes(EVENT.UPDATE_VIEWING_ARTICLE),
//     action: (_data) => {
//       const { article } = _data[EVENT.UPDATE_VIEWING_ARTICLE].data
//       store.syncArticle(article)
//     },
//   },
//   {
//     match: asyncRes(EVENT.LIST_USER_MODAL),
//     action: () => {
//       store.mark({ showUserListModal: true })
//     },
//   },

//   {
//     match: asyncRes(EVENT.UPVOTE_ARTICLE),
//     action: (_data) => {
//       const { data } = _data[EVENT.UPVOTE_ARTICLE]
//       const { article, viewerHasUpvoted } = data
//       handleUpvote(article, viewerHasUpvoted)
//     },
//   },
// ]
// const _handleError = () => {
//   //
// }

// const ErrSolver = [
//   {
//     match: asyncErr(ERR.GRAPHQL),
//     action: ({ details }) => {
//       _handleError()
//       errRescue({ type: ERR.GRAPHQL, details, path: 'GlobalLayout' })
//     },
//   },
//   {
//     match: asyncErr(ERR.TIMEOUT),
//     action: ({ details }) => {
//       _handleError()
//       errRescue({ type: ERR.TIMEOUT, details, path: 'GlobalLayout' })
//     },
//   },
//   {
//     match: asyncErr(ERR.NETWORK),
//     action: () => {
//       _handleError()
//       errRescue({ type: ERR.NETWORK, path: 'GlobalLayout' })
//     },
//   },
// ]

// export const useInit = (_store: TStore): void => {
//   useEffect(() => {
//     store = _store
//     sub$ = sr71$.data().subscribe($solver(DataSolver, ErrSolver))

//     initAppVersion()

//     return () => {
//       sr71$.stop()
//       sub$.unsubscribe()
//     }
//   }, [_store])
// }
