import { includes, reject, uniq } from 'ramda'
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

const assignChecked = <T extends { id?: TID }>(
  entries: readonly T[],
  batchSelectedIDs: readonly TID[],
): readonly (T & { _checked: boolean })[] => {
  return entries.map((item) => ({
    ...item,
    _checked: includes(item.id, batchSelectedIDs),
  }))
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
      dsb$.commit({ loading: false })
      console.log('## TODO handle pagedChangelogs: ', data)
    })
    dsb$.commit({ loading: false })
  }

  const loadChangelogs = (): void => {
    dsb$.commit({ loading: true })
    const params = {
      filter: { page: 1, size: 20, community: community$.slug },
      userHasLogin: false,
    }
    query(S.pagedChangelogs, params).then((data) => {
      dsb$.commit({ loading: false })
      console.log('## TODO handle pagedChangelogs: ', data)
    })
  }

  const batchSelect = (id: TID, selected = true): void => {
    const { batchSelectedIDs } = dsb$

    const _batchSelectedIds = selected
      ? [...batchSelectedIDs, id]
      : reject((_id) => id === _id, batchSelectedIDs)

    dsb$.commit({ batchSelectedIDs: uniq(_batchSelectedIds) })
  }

  const batchSelectAll = (selected: boolean, ids = []): void => {
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
    pagedCommunities: {
      ...pagedCommunities,
      entries: assignChecked(pagedCommunities.entries, batchSelectedIDs),
    },
    pagedPosts: {
      ...pagedPosts,
      entries: assignChecked(pagedPosts.entries, batchSelectedIDs),
    },
    pagedDocs: {
      ...pagedDocs,
      entries: assignChecked(pagedDocs.entries, batchSelectedIDs),
    },
    pagedChangelogs: {
      ...pagedChangelogs,
      entries: assignChecked(pagedChangelogs.entries, batchSelectedIDs),
    },
    faqSections,
    editingFAQ,
    isFaqSectionsTouched: mapArrayChanged('faqSections'),

    loadPosts,
    loadChangelogs,
    batchSelect,
    batchSelectAll,
  }
}
