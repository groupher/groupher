import type { DocumentNode } from 'graphql'
import { useCallback, useEffect, useMemo, useState, type FC } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'
import useViewingArticle from '~/hooks/useViewingArticle'

import S from '../schema'

type Props = { onBack: () => void }
type Event = {
  id: string
  sequence: number
  type: 'create' | 'edit' | 'restore' | 'fork' | 'publish'
  actor_id: number | null
  occurred_at: string
  after_snapshot_id: string
  actor: { login?: string; nickname?: string } | { type: 'system' }
}
type EventPage = { items: Event[]; next_cursor: number | null }
type EventDetail = Event & {
  diff: Diff | null
  contributors: {
    items: Array<{
      actor_id: number | null
      actor: { login?: string; nickname?: string } | { type: 'system' }
      event_ids: string[]
    }>
    next_cursor: number | null
    unknown: boolean
  }
}
type Diff = {
  fields: Record<string, { before: unknown; after: unknown }>
  body: {
    added: Array<{ id: string; after: unknown }>
    removed: Array<{ id: string; before: unknown }>
    changed: Array<{ id: string; before: unknown; after: unknown }>
    moved: Array<{ id: string; from: number[]; to: number[] }>
    duplicate_ids: string[]
    degraded_ids: string[]
  }
  tags: { added: number[]; removed: number[] }
  cover: { before: unknown; after: unknown }
  assetRefs: { added: unknown[]; removed: unknown[]; changed: unknown[] }
}

const HistorySetting: FC<Props> = ({ onBack }) => {
  const { t } = useTrans()
  const { article } = useViewingArticle()
  const [events, setEvents] = useState<Event[]>([])
  const [detail, setDetail] = useState<EventDetail | null>(null)
  const [diff, setDiff] = useState<Diff | null>(null)
  const [beforeId, setBeforeId] = useState('')
  const [afterId, setAfterId] = useState('')
  const [actorId, setActorId] = useState('')
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const request = useCallback(
    async <T,>(query: unknown, variables: Record<string, unknown>): Promise<T> => {
      const response = await browserGraphQLRequest<Record<string, T>>(
        query as DocumentNode,
        variables,
      )
      return Object.values(response)[0]
    },
    [],
  )

  const loadEvents = useCallback(
    async (cursor?: number, filteredActorId = actorId) => {
      if (!article.id) return
      setBusy(true)
      setError(false)
      setDetail(null)
      setDiff(null)
      if (!cursor) {
        setEvents([])
        setBeforeId('')
        setAfterId('')
        setNextCursor(null)
      }
      try {
        const page = await request<EventPage>(S.articleHistoryEvents, {
          articleId: article.id,
          pagi: JSON.stringify({ limit: 20, cursor: cursor ? { sequence: cursor } : undefined }),
          actorId: filteredActorId || undefined,
        })
        setEvents((current) => (cursor ? [...current, ...page.items] : page.items))
        if (!cursor) {
          setBeforeId(page.items.at(-1)?.after_snapshot_id ?? '')
          setAfterId(page.items[0]?.after_snapshot_id ?? '')
        }
        setNextCursor(page.next_cursor)
      } catch {
        setError(true)
      } finally {
        setBusy(false)
      }
    },
    [actorId, article.id, request],
  )

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  const versions = useMemo(() => {
    const seen = new Set<string>()
    return events.filter((event) => {
      if (seen.has(event.after_snapshot_id)) return false
      seen.add(event.after_snapshot_id)
      return true
    })
  }, [events])

  const openEvent = async (eventId: string) => {
    if (!article.id) return
    setBusy(true)
    setError(false)
    setDiff(null)
    try {
      setDetail(
        await request<EventDetail>(S.articleHistoryEvent, { articleId: article.id, eventId }),
      )
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  const loadMoreContributors = async () => {
    if (!article.id || !detail?.contributors.next_cursor) return
    setBusy(true)
    setError(false)
    try {
      const next = await request<EventDetail>(S.articleHistoryEvent, {
        articleId: article.id,
        eventId: detail.id,
        pagi: JSON.stringify({
          limit: 20,
          cursor: { sequence: detail.contributors.next_cursor },
        }),
      })
      setDetail((current) =>
        current
          ? {
              ...current,
              contributors: {
                ...next.contributors,
                items: [...current.contributors.items, ...next.contributors.items],
              },
            }
          : current,
      )
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  const compareVersions = async () => {
    if (!article.id || !beforeId || !afterId || beforeId === afterId) return
    setBusy(true)
    setError(false)
    setDetail(null)
    try {
      setDiff(
        await request<Diff>(S.articleHistoryDiff, {
          articleId: article.id,
          before: { type: 'SNAPSHOT', snapshotId: beforeId },
          after: { type: 'SNAPSHOT', snapshotId: afterId },
        }),
      )
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  const renderValue = (value: unknown) =>
    typeof value === 'string' ? value : (JSON.stringify(value, null, 2) ?? '')

  const renderChange = (label: string, before: unknown, after: unknown, key: string) => (
    <section key={key} className='column border-divider gap-1 rounded border p-2'>
      <strong>{label}</strong>
      <div className='grid grid-cols-2 gap-2'>
        <pre className='text-xs break-words whitespace-pre-wrap'>{renderValue(before)}</pre>
        <pre className='text-xs break-words whitespace-pre-wrap'>{renderValue(after)}</pre>
      </div>
    </section>
  )

  const renderDiff = (value: Diff) => {
    const fields = value.fields ?? {}
    const body = value.body as Partial<Diff['body']> | undefined
    const tags = value.tags as Partial<Diff['tags']> | undefined
    const cover = value.cover as Partial<Diff['cover']> | undefined
    const assetRefs = value.assetRefs as Partial<Diff['assetRefs']> | undefined

    return (
      <div className='column max-h-72 gap-2 overflow-auto'>
        {Object.entries(fields).map(([field, change]) =>
          renderChange(field, change.before, change.after, `field-${field}`),
        )}
        {[...(body?.added ?? []), ...(body?.removed ?? []), ...(body?.changed ?? [])].map(
          (change, index) =>
            renderChange(
              `${t('article.history.field.body')} · ${change.id}`,
              'before' in change ? change.before : null,
              'after' in change ? change.after : null,
              `body-${change.id}-${index}`,
            ),
        )}
        {(body?.moved ?? []).map((change) => (
          <p key={`moved-${change.id}`}>
            {t('article.history.moved')}: {change.id} · {change.from.join('.')} →{' '}
            {change.to.join('.')}
          </p>
        ))}
        {((tags?.added?.length ?? 0) > 0 || (tags?.removed?.length ?? 0) > 0) &&
          renderChange(
            t('article.history.field.tags'),
            { removed: tags?.removed ?? [] },
            { added: tags?.added ?? [] },
            'tags',
          )}
        {cover?.before !== cover?.after &&
          renderChange(t('article.history.field.cover'), cover?.before, cover?.after, 'cover')}
        {((assetRefs?.added?.length ?? 0) > 0 ||
          (assetRefs?.removed?.length ?? 0) > 0 ||
          (assetRefs?.changed?.length ?? 0) > 0) &&
          renderChange(
            t('article.history.field.assets'),
            { removed: assetRefs?.removed ?? [] },
            { added: assetRefs?.added ?? [], changed: assetRefs?.changed ?? [] },
            'assets',
          )}
        {(body?.duplicate_ids?.length ?? 0) > 0 && (
          <p role='alert'>{t('article.history.duplicate_ids')}</p>
        )}
        {(body?.degraded_ids?.length ?? 0) > 0 && <p>{t('article.history.positional_match')}</p>}
      </div>
    )
  }

  return (
    <section className='column gap-2 px-1.5 text-sm'>
      <button type='button' className='text-dim text-left' onClick={onBack}>
        ← {t('article.history')}
      </button>
      {busy && <p role='status'>{t('article.history.loading')}</p>}
      {error && <p role='alert'>{t('article.history.unavailable')}</p>}
      {!detail && !diff && (
        <>
          <div className='column gap-1'>
            <label className='column gap-1'>
              {t('article.history.filter_actor')}
              <select
                value={actorId}
                onChange={(event) => {
                  setActorId(event.target.value)
                  setEvents([])
                  setBeforeId('')
                  setAfterId('')
                  setNextCursor(null)
                }}
              >
                <option value=''>{t('article.history.all_actors')}</option>
                {Array.from(
                  new Map(
                    events
                      .filter((item) => typeof item.actor_id === 'number')
                      .map((item) => [String(item.actor_id), item.actor]),
                  ),
                ).map(([id, actor]) => (
                  <option key={id} value={id}>
                    {'nickname' in actor ? actor.nickname || actor.login : 'System'}
                  </option>
                ))}
              </select>
            </label>
            {events.map((event) => (
              <button
                key={event.id}
                className='hover:bg-hover flex items-center justify-between gap-2 rounded px-2 py-1 text-left'
                type='button'
                onClick={() => void openEvent(event.id)}
              >
                <span>{t(`article.history.event.${event.type}`)}</span>
                <span className='text-dim'>
                  {event.actor && 'nickname' in event.actor
                    ? event.actor.nickname || event.actor.login
                    : 'System'}
                  {' · '}
                  {new Date(event.occurred_at).toLocaleString()}
                </span>
              </button>
            ))}
            {nextCursor !== null && (
              <button
                type='button'
                className='px-2 py-1 text-left'
                onClick={() => void loadEvents(nextCursor)}
              >
                {t('article.history.more')}
              </button>
            )}
          </div>
          <div className='column border-divider gap-2 border-t pt-2'>
            <label className='column gap-1'>
              {t('article.history.compare_before')}
              <select value={beforeId} onChange={(event) => setBeforeId(event.target.value)}>
                {versions.map((event) => (
                  <option key={event.after_snapshot_id} value={event.after_snapshot_id}>
                    #{event.sequence} · {t(`article.history.event.${event.type}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className='column gap-1'>
              {t('article.history.compare_after')}
              <select value={afterId} onChange={(event) => setAfterId(event.target.value)}>
                {versions.map((event) => (
                  <option key={event.after_snapshot_id} value={event.after_snapshot_id}>
                    #{event.sequence} · {t(`article.history.event.${event.type}`)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type='button'
              disabled={busy || !beforeId || !afterId || beforeId === afterId}
              onClick={() => void compareVersions()}
            >
              {t('article.history.compare_versions')}
            </button>
          </div>
        </>
      )}
      {detail && (
        <>
          <button type='button' className='text-left' onClick={() => setDetail(null)}>
            ← {t('article.history')}
          </button>
          <p>
            {t(`article.history.event.${detail.type}`)} ·{' '}
            {new Date(detail.occurred_at).toLocaleString()}
            {' · '}
            {'nickname' in detail.actor ? detail.actor.nickname || detail.actor.login : 'System'}
          </p>
          {detail.diff ? renderDiff(detail.diff) : <p>{t('article.history.no_diff')}</p>}
          {detail.type === 'publish' && (
            <section className='column gap-1'>
              <strong>{t('article.history.contributors')}</strong>
              {detail.contributors.unknown && (
                <p className='text-dim'>{t('article.history.contributors_unknown')}</p>
              )}
              {detail.contributors.items.map((contributor) => (
                <span key={contributor.actor_id ?? contributor.event_ids[0]}>
                  {'nickname' in contributor.actor
                    ? contributor.actor.nickname || contributor.actor.login
                    : 'System'}
                </span>
              ))}
              {detail.contributors.next_cursor !== null && (
                <button
                  type='button'
                  className='text-left underline'
                  onClick={loadMoreContributors}
                >
                  {t('article.history.more')}
                </button>
              )}
            </section>
          )}
        </>
      )}
      {diff && (
        <>
          <button type='button' className='text-left' onClick={() => setDiff(null)}>
            ← {t('article.history')}
          </button>
          {renderDiff(diff)}
        </>
      )}
    </section>
  )
}

export default HistorySetting
