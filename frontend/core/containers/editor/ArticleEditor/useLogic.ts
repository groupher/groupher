import { useCallback } from 'react'
import { pick, keys, mergeDeepRight } from 'ramda'
import { proxy, useSnapshot } from 'valtio'

import type { TSubmitState, TEditMode, TTag, TCommunity, TGroupedTags, TArticleCat } from '~/spec'
import { ARTICLE_CAT } from '~/const/gtd'

import { query } from '~/server'

import useViewingCommunity from '~/hooks/useViewingCommunity'

import type { TEditData, TStore } from './spec'

import S from './schema'

type TRet = {
  onCancel: () => void
  setWordsCountState: () => void
  onPublish: () => void
  getEditData: () => TEditData
  getGroupedTags: () => TGroupedTags
  loadCommunity: () => void
  loadArticle: () => void
  reset: () => void
  onTagSelect: (tag: TTag) => void
  catOnChange: (activeCat: TArticleCat) => void
  changeCommunity: (community: TCommunity) => void
} & TStore

const store = proxy<TStore>({
  mode: 'publish',
  isArchived: false,
  archivedAt: null,

  title: '',
  author: null,
  body: '{}',
  linkAddr: '',
  copyRight: 'cc',
  isQuestion: false,

  articleTags: [],
  company: '',
  companyLink: '',

  // showSubTitle: T.opt(T.bool, false),
  publishing: false,
  publishDone: false,
  //
  wordsCountReady: false,

  // selectors
  activeCat: ARTICLE_CAT.FEATURE,
  activeTag: null,

  get allowEdit(): boolean {
    if (store.mode === 'publish') return true

    return false
  },

  get isArticleAuthor(): boolean {
    return store.allowEdit
  },

  get isReady(): boolean {
    const { title, wordsCountReady } = store
    const titleReady = title.length > 0

    return wordsCountReady && titleReady
  },

  get submitState(): TSubmitState {
    const { mode } = store

    const basicStatus = pick(
      ['publishing', 'publishDone', 'isReady', 'isArchived', 'isArticleAuthor'],
      store,
    )

    return { ...basicStatus, mode: mode as TEditMode }
  },

  commit: (patch: Partial<TStore>): void => {
    Object.assign(store, mergeDeepRight(store, patch))
  },
})

export default (): TRet => {
  const snap = useSnapshot(store)
  const curCommunity = useViewingCommunity()

  const onPublish = (): void => {
    console.log('## onPublish')
    // const { mode } = store
    // store.mark({ publishing: true })

    // mode === 'publish' ? doCreate() : doUpdate()
  }

  const onCancel = (): void => {
    console.log('## onCancel')
  }
  const setWordsCountState = (): void => {
    console.log('## setWordsCountState')
  }

  const getGroupedTags = useCallback((): TGroupedTags => {
    // return root.tagsBar.groupedTags
    return []
  }, [])

  const getEditData = useCallback((): TEditData => {
    const tagsIds = snap.articleTags.map((t) => t.id)
    const baseFields = ['title', 'body', 'copyRight', 'isQuestion', 'linkAddr']

    // @ts-ignore
    return { ...pick(baseFields, snap), articleTags: tagsIds }
  }, [])

  const catOnChange = (activeCat: TArticleCat): void => store.commit({ activeCat })
  const onTagSelect = (activeTag: TTag): void => snap.commit({ activeTag })

  const changeCommunity = (community: TCommunity): void => {
    console.log('## changeCommunity: ', community)
  }

  // why need this?
  const loadCommunity = (): void => {
    const { mode } = snap
    if (mode !== 'publish') return

    const slug = curCommunity.slug
    const params = { slug }
    // console.log('## loadCommunity: ', params)

    query(S.community, params).then((res) => {
      console.log('## loadCommunity: ', res)
    })
  }

  const loadArticle = (): void => {
    console.log('## loadArticle')
    // const { thread, viewingArticle } = store
    // const { id } = viewingArticle

    // sr71$.query(S[thread], { id })
  }

  const reset = (): void => {
    snap.commit({
      mode: 'publish',
      title: '',
      body: '{}',
      linkAddr: '',
      copyRight: 'cc',
      isQuestion: false,
      publishing: false,
      publishDone: false,
    })
  }

  // @ts-ignore
  return {
    ...pick(keys(snap), snap),
    onPublish,
    onCancel,
    setWordsCountState,
    getEditData,
    getGroupedTags,

    // actions
    loadCommunity,
    loadArticle,
    changeCommunity,
    catOnChange,
    onTagSelect,
    reset,
  }
}
