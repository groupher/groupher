import { reject } from 'ramda'
import useCommunity from '~/hooks/useCommunity'
import useDashboard from '~/hooks/useDashboard'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import type { TFAQSection, TID, TPagedArticles, TPagedCommunities } from '~/spec'
import S from '../schema'
import useHelper from './useHelper'

type TRet = {
  loading: boolean
  batchSelectedIDs: readonly TID[]
  pagedPosts: TPagedArticles
  pagedCommunities: TPagedCommunities
  pagedDocs: TPagedArticles
  pagedChangelogs: TPagedArticles

  editingFAQ: TFAQSection
  faqSections: readonly TFAQSection[]
  editingFAQIndex: number | null

  batchSelect: (id: TID, selected?: boolean) => void
  batchSelectAll: (selected: boolean, ids?: TID[]) => void
  loadPosts: () => void
  loadChangelogs: () => void
  isFaqSectionsTouched: boolean
}

export default (): TRet => {
  const dsb$ = useDashboard()
  const community$ = useCommunity()
  const { mapArrayChanged } = useHelper()
  const { query } = useGraphQLClient()

  const {
    loading,
    batchSelectedIDs,
    editingFAQIndex,
    pagedCommunities,
    pagedPosts,
    pagedDocs,
    pagedChangelogs,
    faqSections,
    editingFAQ,
  } = dsb$

  const loadPosts = () => {
    dsb$.commit({ loading: true })
    const params = {
      filter: { page: 1, size: 20, community: community$.slug },
      userHasLogin: false,
    }

    query(S.pagedPosts, params).then((data) => {
      // @ts-expect-error
      dsb$.commit({ loading: false, pagedPosts: data.pagedPosts })
    })
  }

  const loadChangelogs = (): void => {
    dsb$.commit({ loading: true })
    const params = {
      filter: { page: 1, size: 20, community: community$.slug },
      userHasLogin: false,
    }
    query(S.pagedChangelogs, params).then((data) => {
      // @ts-expect-error
      dsb$.commit({ loading: false, pagedChangelogs: data.pagedChangelogs })
    })
  }

  const batchSelect = (id: TID, selected = true): void => {
    const cur = dsb$.batchSelectedIDs

    if (selected) {
      if (cur.includes(id)) return
      dsb$.commit({ batchSelectedIDs: [...cur, id] })
      return
    }

    dsb$.commit({ batchSelectedIDs: reject((_id) => id === _id, cur) })
  }

  const batchSelectAll = (selected: boolean, ids: TID[] = []): void => {
    if (!selected) {
      dsb$.commit({ batchSelectedIDs: [] })
      return
    }
    dsb$.commit({ batchSelectedIDs: ids })
  }

  return {
    loading,
    editingFAQIndex,
    batchSelectedIDs,

    pagedCommunities,
    pagedPosts,
    pagedDocs,
    pagedChangelogs,

    faqSections,
    editingFAQ,
    isFaqSectionsTouched: mapArrayChanged('faqSections'),

    loadPosts,
    loadChangelogs,
    batchSelect,
    batchSelectAll,
  }
}
