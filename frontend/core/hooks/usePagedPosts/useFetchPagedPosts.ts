'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import EVENT from '~/const/event'
import TYPE from '~/const/type'
import URL_PARAM from '~/const/url_param'
import useEvent from '~/hooks/useEvent'
import type { TResState } from '~/spec'
import useArticleList from '~/stores/articleList/hooks'
import useCommunity from '~/stores/community/hooks'
import fetchPagedPosts from './fetchPagedPosts'

type TRefreshPayload = {
  page?: number
}

export default function useFetchPagedPosts() {
  const searchParams = useSearchParams()
  const { slug } = useCommunity()
  const articleList$ = useArticleList()
  const initialSyncSkipped = useRef(false)
  const requestSeq = useRef(0)
  const loadingState = TYPE.RES_STATE.LOADING as TResState
  const doneState = TYPE.RES_STATE.DONE as TResState

  const refreshPagedPosts = async (payload: TRefreshPayload = {}) => {
    const seq = ++requestSeq.current

    articleList$.commit({ resState: loadingState })

    try {
      const pagedPosts = await fetchPagedPosts({
        community: slug,
        page: payload.page,
        tag: searchParams.get(URL_PARAM.TAG),
        cat: searchParams.get(URL_PARAM.CAT),
        state: searchParams.get(URL_PARAM.STATE),
        order: searchParams.get(URL_PARAM.ORDER),
      })

      if (seq !== requestSeq.current || !pagedPosts) return

      articleList$.commit({
        pagedPosts,
        resState: doneState,
      })
    } catch (error) {
      if (seq !== requestSeq.current) return

      console.error(error)
      articleList$.commit({ resState: doneState })
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: searchParams identity is the route-change trigger here
  useEffect(() => {
    if (!initialSyncSkipped.current) {
      initialSyncSkipped.current = true
      return
    }

    void refreshPagedPosts()
  }, [searchParams, slug])

  useEvent<TRefreshPayload>(
    EVENT.REFRESH_ARTICLES,
    (_msg, payload) => {
      void refreshPagedPosts({ page: payload?.page ?? 1 })
    },
    [searchParams, slug],
  )
}
