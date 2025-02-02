// import { useEffect } from 'react'
// import { values } from 'ramda'

// import type { TEditValue, TCommunity, TTag, TArticleCat } from '~/spec'
// import EVENT from '~/const/event'
// import ERR from '~/const/err'

// import asyncSuit from '~/async'
// import { getParameterByName } from '~/utils/route'
// import { errRescue } from '~/signal'
// import { matchArticles } from '~/utils/macros'

// import type { TStore } from './store'
// import S from './schema'

// const { SR71, $solver, asyncRes, asyncErr } = asyncSuit
// const sr71$ = new SR71({
//   // @ts-ignore
//   receive: [EVENT.ARTICLE_SELECTOR],
// })

// let sub$ = null
// let store: TStore | undefined

// export const changeCommunity = (community: TCommunity): void => {
//   store.mark({ community })
// }

// export const onTagSelect = (tag: TTag): void => {
//   store.mark({ activeTag: tag })
// }

// export const loadCommunity = (): void => {
//   const { mode } = store

//   if (mode !== 'publish') return
//   const slug = getParameterByName('community')?.toLowerCase()

//   sr71$.query(S.community, { slug })
// }

// export const loadArticle = (): void => {
//   // const { thread, viewingArticle } = store
//   // const { id } = viewingArticle
//   // sr71$.query(S[thread], { id })
// }

// export const editOnChange = (e: TEditValue, key: string): void => {
//   updateEditing(store, key, e)
// }

// export const onCancel = (): void => {
//   const { mode } = store

//   mode === 'publish' ? gotoBackToCommunity() : gotoArticleDetail()
// }

// const gotoArticleDetail = () => {
//   // const { viewingArticle, thread } = store
//   // Router.push(`/${thread}/${viewingArticle.id}`)
//   console.log('## ## TODO: gotoArticleDetail')
// }

// const gotoBackToCommunity = () => {
//   // const path = slug === HCN ? '/' : `/${slug}`
//   // Router.push(path)
//   console.log('## ## TODO: gotoBackToCommunity')
// }

// export const onPublish = (): void => {
//   const { mode } = store
//   store.mark({ publishing: true })

//   mode === 'publish' ? doCreate() : doUpdate()
// }

// const doCreate = () => {
//   console.log('## TODO doCreate')
//   // const { thread, editData, communityId } = store
//   // const variables = { communityId, ...editData }
//   // const schema = S[`create${titleCase(thread)}`]
//   // sr71$.mutate(schema, variables)
// }

// const doUpdate = () => {
//   console.log('## TODO doUpdate')
//   // const { thread, editData, viewingArticle } = store
//   // const { id } = viewingArticle
//   // const variables = { id, ...editData }
//   // const schema = S[`update${titleCase(thread)}`]
//   // sr71$.mutate(schema, variables)
// }

// export const setWordsCountState = (wordsCountReady: boolean): void => {
//   store?.mark({ wordsCountReady })
// }

// export const catOnChange = (activeCat: TArticleCat) => {
//   store.mark({ activeCat })
// }

// export const tagOnChange = (activeTag: TTag) => {
//   store.mark({ activeTag })
// }

// // ###############################
// // init & uninit handlers
// // ###############################

// const handleArticleRes = (article) => {
//   store.setViewing(article)

//   store.loadEditData(article)
// }

// const handleMutateRes = (data): void => {
//   store.mark({ publishing: false, publishDone: true })
//   store.setViewing(values(data)[0])

//   gotoArticleDetail()
// }

// const DataSolver = [
//   ...matchArticles(handleArticleRes),
//   {
//     match: asyncRes('createPost'),
//     action: handleMutateRes,
//   },
//   {
//     match: asyncRes('updatePost'),
//     action: handleMutateRes,
//   },
//   {
//     match: asyncRes('community'),
//     action: ({ community }) => store.mark({ community }),
//   },
//   {
//     match: asyncRes(EVENT.ARTICLE_SELECTOR),
//     action: (data) => {
//       const {
//         data: { cat, tag },
//       } = data[EVENT.ARTICLE_SELECTOR]

//       cat && catOnChange(cat)
//       tag?.id !== '' && tagOnChange(tag)
//     },
//   },
// ]

// const ErrSolver = [
//   {
//     match: asyncErr(ERR.GRAPHQL),
//     action: ({ details }) => {
//       store.mark({ publishing: false })
//       errRescue({ type: ERR.GRAPHQL, details, path: 'publishPost' })
//       //
//     },
//   },
// ]

// export const useInit = (_store: TStore): void => {
//   useEffect(() => {
//     store = _store
//     sub$ = sr71$.data().subscribe($solver(DataSolver, ErrSolver))

//     loadCommunity()
//     if (store.mode === 'update') loadArticle()

//     // return () => store.reset()
//     return () => {
//       sr71$.stop()
//       sub$.unsubscribe()
//       sub$ = null
//       store.reset()
//     }
//   }, [_store])
// }
