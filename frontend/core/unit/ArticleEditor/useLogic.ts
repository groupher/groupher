import { keys, mergeDeepRight, pick } from 'ramda'
import { useCallback } from 'react'
import { proxy, useSnapshot } from 'valtio'

import { ARTICLE_CAT } from '~/const/gtd'
import { browserQuery } from '~/graphql/client'
import type { TArticleCat, TCommunity, TEditMode, TGroupedTags, TSubmitState, TTag } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import { isWordsCountValid } from '~/ui/WordsCounter/helper'

import S from './schema'
import type { TEditData, TStore } from './spec'

type TRet = {
  onCancel: () => void
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

  communityTags: [],
  company: '',
  companyLink: '',

  // showSubTitle: T.opt(T.bool, false),
  publishing: false,
  publishDone: false,
  //
  wordsCountReady: false,

  // selectors
  activeCat: ARTICLE_CAT.IDEA,
  activeTag: null,

  get allowEdit(): boolean {
    if (store.mode === 'publish') return true

    return false
  },

  get isArticleAuthor(): boolean {
    return store.allowEdit
  },

  get isReady(): boolean {
    const { title, body } = store
    const titleReady = title.length > 0

    return isWordsCountValid(body, 40, 2000) && titleReady
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

/** Exposes logic state and actions through the shared React hook boundary. */
export default function useLogic(): TRet {
  const snap = useSnapshot(store)
  const community$ = useCommunity()

  const onPublish = (): void => {
    console.log('## onPublish')
    // const { mode } = store
    // store.mark({ publishing: true })

    // mode === 'publish' ? doCreate() : doUpdate()
  }

  const onCancel = (): void => {
    console.log('## onCancel')
  }
  const getGroupedTags = useCallback((): TGroupedTags => {
    // return root.tagsBar.groupedTags
    return {}
  }, [])

  const getEditData = useCallback((): TEditData => {
    const tagsIds = store.communityTags.map((t) => t.id)
    const baseFields: (keyof TStore)[] = [
      'title',
      'body',
      'copyRight',
      'isQuestion',
      'linkAddr',
      'company',
      'companyLink',
    ]

    return { ...pick(baseFields, store), communityTags: tagsIds }
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

    const { slug } = community$
    const params = { slug }
    // console.log('## loadCommunity: ', params)

    browserQuery(S.community, params).then((res) => {
      console.log('## loadCommunity: ', res)
    })
  }

  const loadArticle = (): void => {
    console.log('## loadArticle')
    // const { thread, viewingArticle } = store
    // const { id } = viewingArticle

    // sr71$.browserQuery(S[thread], { id })
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

  // @ts-expect-error
  return {
    ...pick(keys(snap), snap),
    onPublish,
    onCancel,
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
