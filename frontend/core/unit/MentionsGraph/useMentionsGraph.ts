import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { MENTIONS_GRAPH_CONTENT_CHANGE } from '~/graphql/client'
import type { MentionsGraphPageQuery } from '~/lib/graphql/generated/graphql'
import {
  mentionsGraphLocatorKey,
  mentionsGraphQueries,
  type MentionsGraphFocus,
} from '~/query/mentionsGraph'
import { isMentionsGraphRestartError } from '~/query/mentionsGraphRecovery'

type Node = MentionsGraphPageQuery['mentionsGraph']['nodes'][number]
type Edge = MentionsGraphPageQuery['mentionsGraph']['edges'][number]

/** Loads only the focus resource’s direct relationship pages and checks the global revision while the tab is mounted. */
export default function useMentionsGraph(community: string, focus: MentionsGraphFocus) {
  const client = useQueryClient()
  const scopeId = `${community}:${mentionsGraphLocatorKey(focus)}`
  const previousRevision = useRef<{ identity: string; revision: string } | null>(null)
  const cursorRestart = useRef<string | null>(null)
  const graphQuery = useInfiniteQuery(mentionsGraphQueries.page(community, focus))
  const revisionQuery = useQuery({
    ...mentionsGraphQueries.revision(community, focus),
  })
  const verifiedRevision =
    revisionQuery.isFetchedAfterMount && !revisionQuery.isError && !revisionQuery.isFetching
      ? revisionQuery.data
      : undefined

  const restart = useCallback(() => {
    return client.resetQueries({
      queryKey: mentionsGraphQueries.page(community, focus).queryKey,
      exact: true,
    })
  }, [client, community, focus, scopeId])

  useEffect(() => {
    if (!graphQuery.isFetchNextPageError || !isMentionsGraphRestartError(graphQuery.error)) return
    if (cursorRestart.current === scopeId) return
    cursorRestart.current = scopeId
    void restart()
  }, [graphQuery.error, graphQuery.isFetchNextPageError, restart, scopeId])

  useEffect(() => {
    const currentRevision = revisionQuery.data
    if (!currentRevision) return

    const previous = previousRevision.current
    if (previous?.identity === scopeId && previous.revision !== currentRevision) {
      cursorRestart.current = `${scopeId}:${currentRevision}`
      void restart()
    }

    previousRevision.current = { identity: scopeId, revision: currentRevision }
  }, [restart, scopeId, revisionQuery.data])

  useEffect(() => {
    if (!verifiedRevision || cursorRestart.current === `${scopeId}:${verifiedRevision}`) return
    if (!graphQuery.data?.pages.some((page) => page.revision !== verifiedRevision)) return

    cursorRestart.current = `${scopeId}:${verifiedRevision}`
    void restart()
  }, [graphQuery.data, restart, scopeId, verifiedRevision])

  useEffect(() => {
    const refresh = () => {
      cursorRestart.current = null
      void restart()
    }

    window.addEventListener(MENTIONS_GRAPH_CONTENT_CHANGE, refresh)
    return () => window.removeEventListener(MENTIONS_GRAPH_CONTENT_CHANGE, refresh)
  }, [restart])

  const graph = useMemo(() => {
    const nodesById = new Map<string, Node>()
    const edgesById = new Map<string, Edge>()

    // A rejected version invalidates the assembled graph, including cached pages.
    const versionRejected =
      !verifiedRevision ||
      graphQuery.isError ||
      graphQuery.data?.pages.some((page) => page.revision !== verifiedRevision)
    if (!versionRejected) {
      graphQuery.data?.pages.forEach((page) => {
        page.nodes.forEach((node) => nodesById.set(node.id, node))
        page.edges.forEach((edge) => edgesById.set(edge.id, edge))
      })
    }

    const lastPage = versionRejected ? null : graphQuery.data?.pages.at(-1)

    return {
      nodes: [...nodesById.values()],
      edges: [...edgesById.values()],
      hasNextPage: lastPage?.hasNextPage ?? false,
    }
  }, [graphQuery.data, graphQuery.isError, verifiedRevision])

  return {
    ...graph,
    loading: (!verifiedRevision && !revisionQuery.isError) || graphQuery.isPending,
    failed: revisionQuery.isError || graphQuery.isError,
    revision: verifiedRevision ?? null,
    retry: () => {
      cursorRestart.current = null
      return restart()
    },
    loadMore: () => graphQuery.fetchNextPage(),
    loadingMore: graphQuery.isFetchingNextPage,
  }
}
