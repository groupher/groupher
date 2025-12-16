import { includes, reject, uniq } from 'ramda'
import useCommunity from '~/hooks/useCommunity'
import useDashboard from '~/hooks/useDashboard'
import { query } from '~/server'
import type {
  TArticleEntries,
  TDsbDocRoute,
  TFAQSection,
  TID,
  TPagedArticles,
  TPagedCommunities,
} from '~/spec'
import S from '../schema'
import useHelper from './useHelper'

type TRet = {
  loading: boolean
  batchSelectedIDs: TID[]
  docTab: TDsbDocRoute

  pagedPosts: TPagedArticles
  pagedCommunities: TPagedCommunities
  pagedDocs: TPagedArticles
  pagedChangelogs: TPagedArticles

  editingFAQ: TFAQSection
  faqSections: TFAQSection[]
  editingFAQIndex: number | null

  batchSelect: (id: TID, selected?: boolean) => void
  batchSelectAll: (selected: boolean, ids?: TID[]) => void
  loadPosts: () => void
  loadChangelogs: () => void
  isFaqSectionsTouched: boolean
}

const assignChecked = (entries: TArticleEntries, batchSelectedIDs: TID[]): TArticleEntries => {
  return entries.map((article) => ({
    ...article,
    _checked: includes(article.id, batchSelectedIDs),
  }))
}

export default (): TRet => {
  const dashboard = useDashboard()
  const curCommunity = useCommunity()
  const { mapArrayChanged } = useHelper()

  const {
    loading,
    batchSelectedIDs,
    docTab,
    editingFAQIndex,
    pagedCommunities,
    pagedPosts,
    pagedDocs,
    pagedChangelogs,
    faqSections,
    editingFAQ,
  } = dashboard

  const loadPosts = () => {
    dashboard.commit({ loading: true })
    const params = {
      filter: { page: 1, size: 20, community: curCommunity.slug },
      userHasLogin: false,
    }

    query(S.pagedPosts, params).then((data) => {
      dashboard.commit({ loading: false })
      console.log('## TODO handle pagedChangelogs: ', data)
    })
    dashboard.commit({ loading: false })
  }

  const loadChangelogs = (): void => {
    dashboard.commit({ loading: true })
    const params = {
      filter: { page: 1, size: 20, community: curCommunity.slug },
      userHasLogin: false,
    }
    query(S.pagedChangelogs, params).then((data) => {
      dashboard.commit({ loading: false })
      console.log('## TODO handle pagedChangelogs: ', data)
    })
  }

  const batchSelect = (id: TID, selected = true): void => {
    const { batchSelectedIDs } = dashboard

    const _batchSelectedIds = selected
      ? [...batchSelectedIDs, id]
      : reject((_id) => id === _id, batchSelectedIDs)

    dashboard.commit({ batchSelectedIDs: uniq(_batchSelectedIds) })
  }

  const batchSelectAll = (selected: boolean, ids = []): void => {
    if (!selected) {
      dashboard.commit({ batchSelectedIDs: [] })
      return
    }

    dashboard.commit({ batchSelectedIDs: ids })
  }

  return {
    loading,
    docTab,
    editingFAQIndex,
    // @ts-expect-error
    batchSelectedIDs,
    pagedCommunities: {
      ...pagedCommunities,
      // @ts-expect-error
      entries: assignChecked(pagedCommunities.entries, batchSelectedIDs),
    },
    pagedPosts: {
      ...pagedPosts,
    // @ts-expect-error
      entries: assignChecked(pagedPosts.entries, batchSelectedIDs),
    },
    pagedDocs: {
      ...pagedDocs,
    // @ts-expect-error
      entries: assignChecked(pagedDocs.entries, batchSelectedIDs),
    },
    pagedChangelogs: {
      ...pagedChangelogs,
    // @ts-expect-error
      entries: assignChecked(pagedChangelogs.entries, batchSelectedIDs),
    },
    // @ts-expect-error
    faqSections,
    editingFAQ,
    isFaqSectionsTouched: mapArrayChanged('faqSections'),

    loadPosts,
    loadChangelogs,
    batchSelect,
    batchSelectAll,
  }
}
