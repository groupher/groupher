'use client'

import { isPlatformHost } from '@groupher/route-contract'
import { useId, useMemo, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import { mentionsGraphLocatorKey, type MentionsGraphFocus } from '~/query/mentionsGraph'

import CommentSeeds from './CommentSeeds'
import useMentionsGraph from './useMentionsGraph'

type Props = {
  community: string
  focus: MentionsGraphFocus
  articleFocus?: MentionsGraphFocus
  onFocusChange?: (focus: MentionsGraphFocus) => void
}
type Node = ReturnType<typeof useMentionsGraph>['nodes'][number]

function publicHref(community: string, path: string): string {
  if (typeof window === 'undefined' || isPlatformHost(window.location.hostname)) return path
  const prefix = `/${community}`
  return path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : path
}

function stableHash(value: string): number {
  let hash = 2_166_136_261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

function nodeLabel(node: Node, t: (key: string) => string): string {
  const title =
    node.type === 'COMMENT'
      ? node.title
        ? `${t('mentions_graph.node.comment')}: ${node.title}`
        : t('mentions_graph.node.comment')
      : node.title || t(`mentions_graph.type.${node.type.toLowerCase()}`)

  if (node.status === 'UNAVAILABLE') return `${title} (${t('mentions_graph.node.unavailable')})`
  if (node.status === 'DELETED') return `${title} (${t('mentions_graph.node.deleted')})`
  return title
}

export default function MentionsGraph({ community, focus, articleFocus, onFocusChange }: Props) {
  const { t } = useTrans()
  const [scale, setScale] = useState(1)
  const [seedsOpen, setSeedsOpen] = useState(false)
  const markerId = useId()
  const { nodes, edges, revision, loading, failed, retry, loadMore, hasNextPage, loadingMore } =
    useMentionsGraph(community, focus)
  const topologyKey = nodes
    .map((node) => node.id)
    .sort()
    .join(':')
  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node] as const)), [nodes])

  const positions = useMemo(() => {
    const center = { x: 300, y: 155 }
    const result = new Map<string, { x: number; y: number }>()

    for (const node of nodes) {
      const locator = node.locator
      const isFocus =
        !!locator && mentionsGraphLocatorKey(locator) === mentionsGraphLocatorKey(focus)

      if (isFocus) {
        result.set(node.id, center)
      } else {
        const angle = (stableHash(node.id) / 4_294_967_296) * Math.PI * 2
        const radius = 48 + (stableHash(`${node.id}:radius`) % 89)
        result.set(node.id, {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
        })
      }
    }

    return result
  }, [topologyKey, focus])

  const complete = !loading && !failed && !hasNextPage

  return (
    <section
      className='border-divider rounded-xl border p-4'
      aria-label={t('mentions_graph.title')}
    >
      <div className='mb-3 flex flex-wrap items-center justify-between gap-3'>
        <h2 className='text-base font-semibold'>{t('mentions_graph.title')}</h2>
        <div className='flex gap-2'>
          <button
            type='button'
            onClick={() => setScale((value) => Math.min(2, value + 0.2))}
            aria-label={t('mentions_graph.zoom_in')}
          >
            +
          </button>
          <button
            type='button'
            onClick={() => setScale((value) => Math.max(0.5, value - 0.2))}
            aria-label={t('mentions_graph.zoom_out')}
          >
            −
          </button>
          <button type='button' onClick={() => setScale(1)}>
            {t('mentions_graph.reset_view')}
          </button>
        </div>
      </div>

      {articleFocus && onFocusChange && (
        <div className='mb-3 flex flex-wrap gap-3'>
          <button
            type='button'
            className='text-accent text-sm hover:underline'
            aria-expanded={seedsOpen}
            onClick={() => setSeedsOpen((open) => !open)}
          >
            {t('mentions_graph.comments.title')}
          </button>
          {focus.type === 'COMMENT' && (
            <button
              type='button'
              className='text-accent text-sm hover:underline'
              onClick={() => onFocusChange(articleFocus)}
            >
              {t('mentions_graph.return_article')}
            </button>
          )}
        </div>
      )}

      {seedsOpen && articleFocus && onFocusChange && (
        <CommentSeeds
          community={community}
          focus={articleFocus}
          revision={revision}
          onSelect={onFocusChange}
        />
      )}

      {nodes.length > 0 && (
        <div className='bg-hoverBg overflow-auto rounded-lg'>
          <svg
            viewBox='0 0 600 310'
            role='img'
            aria-label={t('mentions_graph.graph')}
            className='h-72 w-full min-w-96'
          >
            <defs>
              <marker
                id={markerId}
                markerWidth='7'
                markerHeight='7'
                refX='6'
                refY='3.5'
                orient='auto'
              >
                <path d='M0 0 L7 3.5 L0 7' fill='currentColor' />
              </marker>
            </defs>
            <g transform={`translate(300 155) scale(${scale}) translate(-300 -155)`}>
              {edges.map((edge) => {
                const from = positions.get(edge.from)
                const to = positions.get(edge.to)
                if (!from || !to) return null
                return (
                  <line
                    key={edge.id}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke='currentColor'
                    strokeOpacity='0.45'
                    markerEnd={`url(#${markerId})`}
                  />
                )
              })}
              {nodes.map((node) => {
                const point = positions.get(node.id)
                if (!point) return null
                const circle = (
                  <>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r='9'
                      fill='currentColor'
                      fillOpacity={
                        node.locator &&
                        mentionsGraphLocatorKey(node.locator) === mentionsGraphLocatorKey(focus)
                          ? 1
                          : 0.6
                      }
                    />
                    <title>{nodeLabel(node, t)}</title>
                  </>
                )

                return node.canOpen && node.url ? (
                  <a key={node.id} href={publicHref(community, node.url)}>
                    {circle}
                  </a>
                ) : (
                  <g key={node.id}>{circle}</g>
                )
              })}
            </g>
          </svg>
        </div>
      )}

      <p className='text-digest mt-3 text-sm' role='status'>
        {loading
          ? t('mentions_graph.loading')
          : failed
            ? t('mentions_graph.failed')
            : complete && edges.length === 0
              ? t('mentions_graph.empty')
              : complete
                ? t('mentions_graph.complete')
                : ''}
      </p>
      {failed && (
        <button type='button' onClick={() => void retry()}>
          {t('mentions_graph.recheck')}
        </button>
      )}

      <ul className='mt-4 space-y-2 text-sm' aria-label={t('mentions_graph.links')}>
        {edges.map((edge) => {
          const from = nodesById.get(edge.from)
          const to = nodesById.get(edge.to)
          if (!from || !to) return null
          return (
            <li key={edge.id}>
              {from.canOpen && from.url ? (
                <a className='text-accent hover:underline' href={publicHref(community, from.url)}>
                  {nodeLabel(from, t)}
                </a>
              ) : (
                nodeLabel(from, t)
              )}
              {' → '}
              {to.canOpen && to.url ? (
                <a className='text-accent hover:underline' href={publicHref(community, to.url)}>
                  {nodeLabel(to, t)}
                </a>
              ) : (
                nodeLabel(to, t)
              )}
            </li>
          )
        })}
      </ul>
      {hasNextPage && (
        <button
          type='button'
          className='text-accent mt-3 text-sm hover:underline'
          disabled={loadingMore}
          onClick={() => void loadMore()}
        >
          {t('mentions_graph.more')}
        </button>
      )}
    </section>
  )
}
