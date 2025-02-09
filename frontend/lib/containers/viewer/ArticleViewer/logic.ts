// import { useEffect } from 'react'
// // import { mergeRight } from 'ramda'

// import type { TArticle } from '~/spec'

// import EVENT from '~/const/event'
// import ERR from '~/const/err'
// import { errRescue } from '~/signal'
// import asyncSuit from '~/async'
// import { scrollDrawerToTop } from '~/dom'
// import { matchArticles } from '~/utils/macros'

// // import S from './schema'
// import type { TStore } from './store'

// const { SR71, $solver, asyncRes, asyncErr } = asyncSuit
// const sr71$ = new SR71({
//   // @ts-ignore
//   receive: [EVENT.DRAWER.CLOSE, EVENT.RELOAD_ARTICLE],
// })

// let store: TStore | undefined
// let sub$ = null

// const loadArticle = (): void => {
//   markLoading()

//   // const userHasLogin = false
//   // const { originalCommunitySlug, innerId, meta } = store.viewingArticle

//   // const variables = { community: originalCommunitySlug, id: innerId, userHasLogin }

//   // sr71$.query(S.getArticle(meta.thread), variables)
// }

// const markLoading = (maybe = true) => store.mark({ loading: maybe })

// const handleArticleRes = (article: TArticle): void => {
//   // console.log('## # handleArticleRes: ', article)
//   markLoading(false)

//   // const thread = article.meta.thread.toLowerCase()
//   // const { document, ...restArticle } = article
//   // store.mark({ document })
//   // store.setViewing({ [thread]: mergeRight(store.viewingArticle, restArticle) })

//   setTimeout(() => {
//     const { id, viewerHasUpvoted, views, upvotesCount } = article
//     store.syncArticle({
//       id,
//       viewerHasUpvoted,
//       views,
//       upvotesCount,
//       viewerHasViewed: true,
//     })
//   }, 500)
// }

// export const holder = 1

// // ###############################
// // init & uninit handlers
// // ###############################
// const DataSolver = [
//   ...matchArticles(handleArticleRes),
//   {
//     match: asyncRes(EVENT.RELOAD_ARTICLE),
//     action: () => {
//       scrollDrawerToTop()
//       markLoading(true)
//       loadArticle()
//     },
//   },

//   {
//     match: asyncRes(EVENT.DRAWER.CLOSE),
//     action: () => {
//       sr71$.stop()
//       markLoading(false)
//     },
//   },

//   // {
//   //   match: asyncRes('setTag'),
//   //   action: () => {
//   //     loadPost(store.viewingArticle)
//   //     closeDrawer()
//   //     store.setViewing({ post: {} })
//   //   },
//   // },
//   // {
//   //   match: asyncRes('unsetTag'),
//   //   action: () => {
//   //     loadPost(store.viewingArticle)
//   //     closeDrawer()
//   //     store.setViewing({ post: {} })
//   //   },
//   // },
// ]
// const ErrSolver = [
//   {
//     match: asyncErr(ERR.GRAPHQL),
//     action: () => {
//       //
//     },
//   },
//   {
//     match: asyncErr(ERR.TIMEOUT),
//     action: ({ details }) => errRescue({ type: ERR.TIMEOUT, details, path: 'PostViewer' }),
//   },
//   {
//     match: asyncErr(ERR.NETWORK),
//     action: () => errRescue({ type: ERR.NETWORK, path: 'PostViewer' }),
//   },
// ]

// // ###############################
// // init & uninit
// // ###############################
// export const useInit = (_store: TStore): void => {
//   useEffect(() => {
//     store = _store
//     sub$ = sr71$.data().subscribe($solver(DataSolver, ErrSolver))
//     // loadArticle()

//     return () => {
//       store.reset()
//       sr71$.stop()
//       sub$.unsubscribe()
//     }
//   }, [_store])
// }
