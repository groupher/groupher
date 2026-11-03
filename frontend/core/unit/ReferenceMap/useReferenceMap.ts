import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { REFERENCE_MAP_CONTENT_CHANGE } from '~/graphql/client'
import {
  referenceMapQueries,
  type ReferenceMapFocus,
  type ReferenceMapFrontier,
} from '~/query/referenceMap'

type Node = {
  id: string
  type: string
  articleInnerId: string
  commentInnerId?: string | null
  title: string
  url: string
  syncState: string
}
type Edge = { id: string; from: string; to: string; occurrencesCount: number }
type QueueItem = { node: ReferenceMapFocus; after?: string | null }

const BUDGET = { nodes: 150, edges: 300, requests: 10 }

/** Loads a Community-local directed graph under a bounded breadth-first request budget. */
export default function useReferenceMap(community: string, focus: ReferenceMapFocus) {
  const client = useQueryClient()
  const [snapshot, setSnapshot] = useState({
    nodes: [] as Node[],
    edges: [] as Edge[],
    pending: false,
    loading: true,
    paused: false,
    failed: false,
    timedOut: false,
  })
  const graph = useRef({
    nodes: new Map<string, Node>(),
    edges: new Map<string, Edge>(),
    queue: [{ node: focus }] as QueueItem[],
    queued: new Set<string>(),
    visited: new Set<string>(),
    pending: false,
    requests: 0,
    generation: 0,
    revision: null as string | null,
    commentAfter: null as string | null,
    commentsDone: !['POST', 'BLOG', 'CHANGELOG', 'DOC'].includes(focus.type),
  })
  const focusKey = `${focus.type}:${focus.articleInnerId}:${focus.commentInnerId ?? ''}`
  const canonicalFocus = useMemo(
    () => ({
      type: focus.type,
      articleInnerId: focus.articleInnerId,
      ...(focus.commentInnerId ? { commentInnerId: focus.commentInnerId } : {}),
    }),
    [focusKey],
  )

  const publish = useCallback(
    (loading: boolean, failed = false) => {
      const current = graph.current
      const connected = new Set<string>()
      for (const edge of current.edges.values()) {
        connected.add(edge.from)
        connected.add(edge.to)
      }
      setSnapshot({
        nodes: [...current.nodes.values()].filter(
          (node) =>
            connected.has(node.id) ||
            (node.type === focus.type &&
              node.articleInnerId === focus.articleInnerId &&
              (node.commentInnerId ?? null) === (focus.commentInnerId ?? null)),
        ),
        edges: [...current.edges.values()],
        pending: current.pending,
        loading,
        paused: (current.queue.length > 0 || !current.commentsDone) && !loading,
        failed,
        timedOut: false,
      })
    },
    [focusKey],
  )

  const load = useCallback(
    async (reset: boolean) => {
      const previous = reset ? graph.current : null
      if (reset) {
        graph.current = {
          nodes: new Map<string, Node>(),
          edges: new Map<string, Edge>(),
          queue: [{ node: canonicalFocus }],
          queued: new Set<string>(),
          visited: new Set<string>(),
          pending: false,
          requests: 0,
          generation: graph.current.generation + 1,
          revision: graph.current.revision,
          commentAfter: null as string | null,
          commentsDone: !['POST', 'BLOG', 'CHANGELOG', 'DOC'].includes(canonicalFocus.type),
        }
      }

      const current = graph.current
      const generation = current.generation
      const requestLimit = current.requests + BUDGET.requests
      const edgeLimit = current.edges.size + BUDGET.edges
      const nodeLimit = current.nodes.size + BUDGET.nodes
      let currentBatch: QueueItem[] = []
      if (reset) {
        setSnapshot((snapshot) => ({ ...snapshot, loading: true, failed: false }))
      } else {
        publish(true)
      }

      try {
        const loadCommentSeeds = async () => {
          const page = await client.fetchQuery(
            referenceMapQueries.articleComments(community, canonicalFocus, current.commentAfter),
          )
          if (generation !== current.generation) return
          current.requests += 1
          current.commentAfter = page.endCursor ?? null
          current.commentsDone = !page.hasNextPage
          for (const node of page.comments) {
            const key = `${node.type}:${node.articleInnerId}:${node.commentInnerId ?? ''}`
            if (current.visited.has(key) || current.queued.has(key)) continue
            current.queued.add(key)
            current.queue.push({ node })
          }
        }

        if (!current.commentsDone && current.requests < requestLimit) {
          await loadCommentSeeds()
          if (generation !== current.generation) return
        }
        while (
          (current.queue.length > 0 || !current.commentsDone) &&
          current.requests < requestLimit &&
          current.edges.size < edgeLimit &&
          current.nodes.size < nodeLimit
        ) {
          if (current.queue.length === 0) {
            await loadCommentSeeds()
            if (generation !== current.generation) return
            continue
          }
          const remainingEdges = edgeLimit - current.edges.size
          const remainingNodes = nodeLimit - current.nodes.size
          const batchSize = Math.min(10, current.queue.length, remainingEdges, remainingNodes)
          const first = Math.min(
            20,
            Math.floor(remainingEdges / batchSize),
            Math.floor(remainingNodes / batchSize),
          )
          if (first < 1) break

          const batch = current.queue.splice(0, batchSize)
          currentBatch = batch
          const frontiers: ReferenceMapFrontier[] = batch.map((entry) => ({
            node: entry.node,
            after: entry.after,
          }))
          const page = await client.fetchQuery(
            referenceMapQueries.page(community, canonicalFocus, frontiers, first),
          )
          if (generation !== current.generation) return
          current.requests += 1
          current.pending ||= page.projectionPending

          for (const node of page.nodes) {
            current.nodes.set(node.id, node)
          }
          for (const edge of page.edges) {
            current.edges.set(edge.id, edge)
          }
          for (const neighborhood of page.neighborhoods) {
            if (neighborhood.state !== 'AVAILABLE') continue
            const entry = batch[neighborhood.requestIndex]
            if (!entry) continue
            const key = `${entry.node.type}:${entry.node.articleInnerId}:${entry.node.commentInnerId ?? ''}`
            current.visited.add(key)
            if (neighborhood.hasNextPage && neighborhood.endCursor) {
              current.queue.push({ node: entry.node, after: neighborhood.endCursor })
            }
          }
          for (const node of page.nodes) {
            const key = `${node.type}:${node.articleInnerId}:${node.commentInnerId ?? ''}`
            if (current.visited.has(key) || current.queued.has(key)) continue
            current.queued.add(key)
            current.queue.push({
              node: {
                type: node.type as ReferenceMapFocus['type'],
                articleInnerId: node.articleInnerId,
                ...(node.commentInnerId ? { commentInnerId: node.commentInnerId } : {}),
              },
            })
          }
          currentBatch = []
          publish(true)
        }
        publish(false)
      } catch {
        if (generation === current.generation) {
          if (reset && previous && current.requests === 0) {
            graph.current = { ...previous, generation }
          } else {
            current.queue.unshift(...currentBatch)
          }
          publish(false, true)
        }
      }
    },
    [client, community, canonicalFocus, publish],
  )

  useEffect(() => {
    let active = true
    graph.current.generation += 1
    graph.current.requests = 0
    graph.current.revision = null
    queueMicrotask(() => {
      if (active) void load(true)
    })
    return () => {
      active = false
      graph.current.generation += 1
    }
  }, [focusKey, community, load])

  useEffect(() => {
    const invalidate = () => {
      void client.cancelQueries({ queryKey: referenceMapQueries.key(community) })
      client.removeQueries({ queryKey: referenceMapQueries.key(community) })
      void load(true)
    }
    window.addEventListener(REFERENCE_MAP_CONTENT_CHANGE, invalidate)
    return () => window.removeEventListener(REFERENCE_MAP_CONTENT_CHANGE, invalidate)
  }, [client, community, load])

  useEffect(() => {
    const verify = async () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      const generation = graph.current.generation
      try {
        const revision = await client.fetchQuery({
          ...referenceMapQueries.revision(community, canonicalFocus),
          staleTime: 0,
          gcTime: 0,
        })
        const current = graph.current
        if (generation !== current.generation) return
        if (current.revision !== null && current.revision !== revision) {
          current.revision = revision
          client.removeQueries({ queryKey: referenceMapQueries.key(community) })
          current.requests = 0
          void load(true)
        } else {
          current.revision = revision
        }
      } catch (error) {
        if (generation !== graph.current.generation) return
        if (error instanceof Error && error.message.trim() === 'not found') {
          graph.current.nodes.clear()
          graph.current.edges.clear()
          graph.current.queue = []
          setSnapshot({
            nodes: [],
            edges: [],
            pending: false,
            loading: false,
            paused: false,
            failed: true,
            timedOut: false,
          })
        } else {
          setSnapshot((current) => ({ ...current, failed: true, loading: false }))
        }
      }
    }
    const interval = window.setInterval(verify, 30_000)
    window.addEventListener('focus', verify)
    window.addEventListener('online', verify)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', verify)
      window.removeEventListener('online', verify)
    }
  }, [client, community, canonicalFocus, load])

  useEffect(() => {
    if (!snapshot.pending || snapshot.loading) return
    let cancelled = false
    const started = Date.now()
    const delays = [2_000, 4_000, 8_000, 16_000, 30_000]
    let attempt = 0
    let timer: ReturnType<typeof setTimeout>

    const check = async () => {
      if (cancelled || document.visibilityState !== 'visible' || !navigator.onLine) return
      try {
        const page = await client.fetchQuery({
          ...referenceMapQueries.page(community, canonicalFocus, [{ node: canonicalFocus }]),
          staleTime: 0,
          gcTime: 0,
        })
        if (cancelled) return
        if (!page.projectionPending && page.nodes.every((node) => node.syncState === 'READY')) {
          await client.cancelQueries({ queryKey: referenceMapQueries.key(community) })
          client.removeQueries({ queryKey: referenceMapQueries.key(community) })
          void load(true)
          return
        }
      } catch {
        // Keep the current graph while the durable sync worker catches up.
      }
      if (Date.now() - started >= 120_000) {
        setSnapshot((current) => ({ ...current, timedOut: true }))
      } else {
        timer = setTimeout(check, delays[Math.min(attempt++, delays.length - 1)])
      }
    }

    timer = setTimeout(check, delays[attempt++])
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [snapshot.pending, snapshot.loading, client, community, canonicalFocus, load])

  return {
    ...snapshot,
    continueLoading: () => void load(false),
    retry: () => void load(!snapshot.failed),
  }
}
