import { useCallback } from 'react'
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

  // 原有 action（如果别处用得到）
  batchSelect: (id: TID, selected?: boolean) => void
  batchSelectAll: (selected: boolean, ids?: TID[]) => void

  loadPosts: () => void
  loadChangelogs: () => void
  isFaqSectionsTouched: boolean
}

export default function useCMSInfo(): TRet {
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

  const loadPosts = useCallback(() => {
    dsb$.commit({ loading: true })
    const params = {
      filter: { page: 1, size: 20, community: community$.slug },
      userHasLogin: false,
    }

    query(S.pagedPosts, params).then((data) => {
      // @ts-expect-error
      dsb$.commit({ loading: false, pagedPosts: data.pagedPosts })
    })
  }, [dsb$, community$.slug, query])

  const loadChangelogs = useCallback((): void => {
    dsb$.commit({ loading: true })
    const params = {
      filter: { page: 1, size: 20, community: community$.slug },
      userHasLogin: false,
    }
    query(S.pagedChangelogs, params).then((data) => {
      // @ts-expect-error
      dsb$.commit({ loading: false, pagedChangelogs: data.pagedChangelogs })
    })
  }, [dsb$, community$.slug, query])

  /**
   * 仍保留 batchSelect/batchSelectAll，但内部必须读 live store，避免“丢 21”
   */
  const batchSelect = useCallback(
    (id: TID, selected = true): void => {
      const key = String(id)
      const cur = (dsb$.live$.batchSelectedIDs ?? []).map(String) as string[]
      const set = new Set(cur)
      if (selected) set.add(key)
      else set.delete(key)
      dsb$.commit({ batchSelectedIDs: Array.from(set) as unknown as TID[] })
    },
    [dsb$],
  )

  const batchSelectAll = useCallback(
    (selected: boolean, ids: TID[] = []): void => {
      if (!selected) {
        dsb$.commit({ batchSelectedIDs: [] })
        return
      }
      dsb$.commit({ batchSelectedIDs: ids.map(String) as unknown as TID[] })
    },
    [dsb$],
  )

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
