'use client'

import { isPlatformHost } from '@groupher/route-contract'
import { useId, useMemo, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import type { ReferenceMapFocus } from '~/query/referenceMap'

import useReferenceMap from './useReferenceMap'

type Props = { community: string; focus: ReferenceMapFocus }

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

export default function ReferenceMap({ community, focus }: Props) {
  const { t } = useTrans()
  const label = (node: { type: string; title: string }) =>
    node.type === 'COMMENT'
      ? node.title
        ? `${t('reference_map.linked_comment')}: ${node.title}`
        : t('reference_map.linked_comment')
      : node.title || node.type
  const [scale, setScale] = useState(1)
  const markerId = useId()
  const { nodes, edges, pending, loading, paused, failed, timedOut, continueLoading, retry } =
    useReferenceMap(community, focus)
  const topologyKey = nodes
    .map((node) => node.id)
    .sort()
    .join(':')
  const focusKey = `${community}:${focus.type}:${focus.articleInnerId}:${focus.commentInnerId ?? ''}`

  const positions = useMemo(() => {
    const center = { x: 300, y: 155 }
    const result = new Map<string, { x: number; y: number }>()
    for (const node of nodes) {
      const isFocus =
        node.type === focus.type &&
        node.articleInnerId === focus.articleInnerId &&
        (node.commentInnerId ?? null) === (focus.commentInnerId ?? null)
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
  }, [topologyKey, focusKey])

  const complete =
    !loading && !paused && !pending && !failed && nodes.every((node) => node.syncState === 'READY')

  return (
    <section
      className='border-divider my-8 rounded-xl border p-4'
      aria-label={t('reference_map.title')}
    >
      <div className='mb-3 flex flex-wrap items-center justify-between gap-3'>
        <h2 className='text-base font-semibold'>{t('reference_map.title')}</h2>
        <div className='flex gap-2'>
          <button
            type='button'
            onClick={() => setScale((value) => Math.min(2, value + 0.2))}
            aria-label={t('reference_map.zoom_in')}
          >
            +
          </button>
          <button
            type='button'
            onClick={() => setScale((value) => Math.max(0.5, value - 0.2))}
            aria-label={t('reference_map.zoom_out')}
          >
            −
          </button>
          <button type='button' onClick={() => setScale(1)}>
            {t('reference_map.reset_view')}
          </button>
        </div>
      </div>

      {nodes.length > 0 && (
        <div className='bg-hoverBg overflow-auto rounded-lg'>
          <svg
            viewBox='0 0 600 310'
            role='img'
            aria-label={t('reference_map.graph')}
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
                return (
                  <a key={node.id} href={publicHref(community, node.url)}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r='9'
                      fill='currentColor'
                      fillOpacity={
                        node.type === focus.type &&
                        node.articleInnerId === focus.articleInnerId &&
                        (node.commentInnerId ?? null) === (focus.commentInnerId ?? null)
                          ? 1
                          : 0.6
                      }
                    />
                    <title>{label(node)}</title>
                  </a>
                )
              })}
            </g>
          </svg>
        </div>
      )}

      <p className='text-digest mt-3 text-sm' role='status'>
        {loading
          ? t('reference_map.loading')
          : failed
            ? t('reference_map.failed')
            : pending
              ? t(timedOut ? 'reference_map.incomplete' : 'reference_map.pending')
              : paused
                ? t('reference_map.paused')
                : complete && edges.length === 0
                  ? t('reference_map.empty')
                  : complete
                    ? t('reference_map.complete')
                    : ''}
      </p>
      <div className='mt-2 flex gap-3'>
        {paused && (
          <button type='button' onClick={continueLoading}>
            {t('reference_map.continue')}
          </button>
        )}
        {(failed || pending) && (
          <button type='button' onClick={retry}>
            {t('reference_map.recheck')}
          </button>
        )}
      </div>

      <ul className='mt-4 space-y-2 text-sm' aria-label={t('reference_map.links')}>
        {edges.map((edge) => {
          const from = nodes.find((node) => node.id === edge.from)
          const to = nodes.find((node) => node.id === edge.to)
          if (!from || !to) return null
          return (
            <li key={edge.id}>
              <a className='text-accent hover:underline' href={publicHref(community, from.url)}>
                {label(from)}
              </a>
              {' → '}
              <a className='text-accent hover:underline' href={publicHref(community, to.url)}>
                {label(to)}
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
