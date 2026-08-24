'use client'

import { useQuery } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import type { CommunityActivityQuery } from '~/lib/graphql/generated/graphql'
import { Q } from '~/query'

import {
  activityActionLabel,
  activityMessage,
  activityResourceTypeLabel,
  activityResourceLabel,
  activityValueLabel,
} from './copy'

type TActivityEntry = CommunityActivityQuery['communityActivity']['entries'][number]
type TActivityDetail = TActivityEntry & {
  childEvents?: TActivityEntry[]
  parentEvent?: TActivityEntry | null
}

const isoDayWindow = () => {
  const end = new Date()
  end.setUTCHours(24, 0, 0, 0)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 6)
  return { after: start.toISOString(), before: end.toISOString() }
}

const localDateKey = (value: unknown) => {
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return ''
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, '0')))
    .join('-')
}

const dateLabel = (t: Parameters<typeof activityMessage>[0], key: string) => {
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return t('dsb.activity.today')
  if (date.toDateString() === yesterday.toDateString()) return t('dsb.activity.yesterday')

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

const displayDate = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(value),
  )
}

export default function Activity({ community }: { community: string }) {
  const { t } = useTrans()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()
  const currentParams = useMemo(() => new URLSearchParams(queryString), [queryString])
  const window = useMemo(isoDayWindow, [])
  const [resourceType, setResourceType] = useState('')
  const [action, setAction] = useState('')
  const [category, setCategory] = useState('')
  const [source, setSource] = useState('')
  const [actorRef, setActorRef] = useState('')
  const [subjectQuery, setSubjectQuery] = useState('')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [highRiskOnly, setHighRiskOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedEntry, setSelectedEntry] = useState<TActivityEntry | null>(null)
  const [expandedOperations, setExpandedOperations] = useState<Set<string>>(new Set())
  const [newActivityCount, setNewActivityCount] = useState(0)
  const latestEntryId = useRef<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const configQuery = useQuery(Q.activity.config(community))
  const eventRefParam = currentParams.get('eventRef') || ''
  const eventQuery = useQuery(Q.activity.event(community, eventRefParam))

  useEffect(() => {
    const get = (key: string) => currentParams.get(key) || ''
    const nextPage = Number(currentParams.get('page') || '1')

    setResourceType(get('resourceTypes'))
    setAction(get('actions'))
    setCategory(get('categories'))
    setSource(get('source'))
    setActorRef(get('actorRef'))
    setSubjectQuery(get('subjectQuery'))
    setSelectedDay(get('selectedDay') || null)
    setHighRiskOnly(currentParams.get('highRisk') === '1')
    setPage(Number.isInteger(nextPage) && nextPage > 0 ? nextPage : 1)
  }, [currentParams])

  const updateUrl = (
    values: Record<string, string | null>,
    history: 'push' | 'replace' = 'push',
  ) => {
    const next = new URLSearchParams(queryString)
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }

    router[history](`${pathname}${next.toString() ? `?${next.toString()}` : ''}`, { scroll: false })
  }

  const highRiskActions = Array.from(
    new Set(
      configQuery.data?.resources.flatMap((resource) =>
        resource.actions.filter((item) => item.highRisk).map((item) => item.action),
      ),
    ),
  )

  const baseFilter = useMemo(
    () => ({
      resourceTypes: resourceType ? [resourceType] : undefined,
      actions: highRiskOnly ? highRiskActions : action ? [action] : undefined,
      categories: category ? [category] : undefined,
      actorRef: actorRef || undefined,
      source: source || undefined,
      subjectQuery: subjectQuery.trim() || undefined,
    }),
    [action, actorRef, category, highRiskActions, highRiskOnly, resourceType, source, subjectQuery],
  )

  const statsFilter = useMemo(
    () => ({ ...baseFilter, occurredAfter: window.after, occurredBefore: window.before }),
    [baseFilter, window],
  )

  const statsQuery = useQuery(Q.activity.stats(community, statsFilter))
  const buckets = statsQuery.data?.buckets ?? []
  const selectedBucket = buckets.find((bucket) => String(bucket.startedAt) === selectedDay)
  const listFilter = useMemo(
    () => ({
      ...baseFilter,
      page,
      occurredAfter: selectedBucket ? String(selectedBucket.startedAt) : window.after,
      occurredBefore: selectedBucket ? String(selectedBucket.endedAt) : window.before,
    }),
    [baseFilter, page, selectedBucket, window],
  )

  const activityQuery = useQuery(Q.activity.list(community, listFilter))
  const resourceTypes = configQuery.data?.resources.map((resource) => resource.resourceType) ?? []
  const sources = configQuery.data?.sources ?? []
  const actions = Array.from(
    new Map(
      configQuery.data?.resources.flatMap((resource) =>
        resource.actions.map((item) => [item.action, item.messageKey] as const),
      ),
    ),
  ).map(([value, messageKey]) => ({ value, label: activityActionLabel(t, messageKey) }))
  const categories = Array.from(
    new Set(
      configQuery.data?.resources.flatMap((resource) =>
        resource.actions.map((item) => item.category),
      ),
    ),
  )
  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count))
  const eventDetail = eventQuery.data as TActivityDetail | null | undefined
  const operationGroups = useMemo(() => {
    const dates = new Map<string, Map<string, TActivityEntry[]>>()

    for (const entry of activityQuery.data?.entries ?? []) {
      const key = localDateKey(entry.occurredAt)
      const groups = dates.get(key) ?? new Map<string, TActivityEntry[]>()
      const operationKey = entry.operationRef || entry.eventRef || entry.id
      groups.set(operationKey, [...(groups.get(operationKey) ?? []), entry])
      dates.set(key, groups)
    }

    return Array.from(dates, ([key, groups]) => ({
      key,
      label: dateLabel(t, key),
      groups: Array.from(groups, ([operationKey, entries]) => ({ key: operationKey, entries })),
    }))
  }, [activityQuery.data?.entries])

  useEffect(() => {
    const firstEntry = activityQuery.data?.entries[0]
    if (!firstEntry) return
    if (latestEntryId.current && latestEntryId.current !== firstEntry.id) {
      setNewActivityCount((count) => Math.max(count, 1))
    }
    latestEntryId.current = firstEntry.id
  }, [activityQuery.data?.entries])

  useEffect(() => {
    if (!eventRefParam) {
      setSelectedEntry(null)
      return
    }

    const entry =
      activityQuery.data?.entries.find((item) => item.eventRef === eventRefParam) ?? eventDetail
    if (entry) setSelectedEntry(entry)
  }, [activityQuery.data?.entries, eventDetail, eventRefParam])

  const changeFilter = (key: string, value: string, setter: (value: string) => void) => {
    setter(value)
    setPage(1)
    updateUrl({ [key]: value || null, page: '1' })
  }

  const openEntry = (entry: TActivityEntry) => {
    setSelectedEntry(entry)
    updateUrl({ eventRef: entry.eventRef || null })
  }

  const renderEntry = (entry: TActivityEntry) => (
    <button
      className='hover:bg-hover flex w-full items-start gap-3 px-5 py-4 text-left transition-colors'
      key={entry.id}
      onClick={() => openEntry(entry)}
      type='button'
    >
      <span className='bg-accent/15 text-accent mt-0.5 rounded-full px-2 py-1 text-[11px] font-medium'>
        {activityResourceLabel(t, entry)}
      </span>
      <div className='min-w-0 flex-1'>
        <p className='text-sm'>{activityMessage(t, entry)}</p>
        <p className='text-digest mt-1 text-xs'>
          {new Date(String(entry.occurredAt)).toLocaleString()} ·{' '}
          {activityValueLabel(t, 'source', entry.source)}
        </p>
      </div>
    </button>
  )

  const downloadExport = async (format: 'CSV' | 'JSON') => {
    setExporting(true)

    try {
      const response = await Q.activity.export(community, listFilter, format)
      const payload = response.communityActivityExport
      const blob = new Blob([payload.content], { type: payload.mimeType })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = payload.filename
      anchor.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const detailEntry = eventDetail || selectedEntry
  const parentEntry = eventDetail?.parentEvent
  const childEntries = eventDetail?.childEvents ?? []
  const totalPages = activityQuery.data?.totalPages ?? 1
  const pageNumber = activityQuery.data?.pageNumber ?? page

  return (
    <main className='flex flex-col gap-4'>
      <section className='bg-card border-divider rounded-md border px-5 py-4'>
        <div className='mb-4 flex items-center justify-between'>
          <div>
            <h1 className='text-lg font-semibold'>{t('dsb.activity.title')}</h1>
            <p className='text-digest text-xs'>{t('dsb.activity.description')}</p>
          </div>
          <span className='text-digest text-sm'>
            {statsQuery.data?.totalCount ?? 0} {t('dsb.activity.events')}
          </span>
        </div>
        <div className='flex h-28 items-end gap-2'>
          {buckets.map((bucket) => {
            const startedAt = String(bucket.startedAt)
            const active = selectedDay === startedAt
            return (
              <button
                className='group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1'
                key={startedAt}
                onClick={() => {
                  const nextDay = active ? null : startedAt
                  setSelectedDay(nextDay)
                  setPage(1)
                  updateUrl({ selectedDay: nextDay, page: '1' })
                }}
                type='button'
              >
                <span className='text-digest text-xs opacity-0 transition-opacity group-hover:opacity-100'>
                  {bucket.count}
                </span>
                <span
                  className={`w-full rounded-t-sm transition-colors ${active ? 'bg-accent' : 'bg-accent/50 group-hover:bg-accent/80'}`}
                  style={{ height: `${Math.max(4, (bucket.count / maxCount) * 76)}px` }}
                />
                <span className='text-digest text-xs'>{displayDate(startedAt)}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className='bg-card border-divider flex flex-wrap items-center gap-2 rounded-md border px-4 py-3'>
        <select
          className='bg-card border-divider rounded border px-2 py-1.5 text-sm'
          onChange={(event) => changeFilter('resourceTypes', event.target.value, setResourceType)}
          value={resourceType}
        >
          <option value=''>{t('dsb.activity.all_resources')}</option>
          {resourceTypes.map((value) => (
            <option key={value} value={value}>
              {activityResourceTypeLabel(t, value)}
            </option>
          ))}
        </select>
        <select
          className='bg-card border-divider rounded border px-2 py-1.5 text-sm'
          onChange={(event) => changeFilter('source', event.target.value, setSource)}
          value={source}
        >
          <option value=''>{t('dsb.activity.all_sources')}</option>
          {sources.map((value) => (
            <option key={value} value={value}>
              {activityValueLabel(t, 'source', value)}
            </option>
          ))}
        </select>
        <select
          className='bg-card border-divider rounded border px-2 py-1.5 text-sm'
          onChange={(event) => changeFilter('actions', event.target.value, setAction)}
          value={action}
        >
          <option value=''>{t('dsb.activity.all_actions')}</option>
          {actions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <select
          className='bg-card border-divider rounded border px-2 py-1.5 text-sm'
          onChange={(event) => changeFilter('categories', event.target.value, setCategory)}
          value={category}
        >
          <option value=''>{t('dsb.activity.all_categories')}</option>
          {categories.map((value) => (
            <option key={value} value={value}>
              {activityValueLabel(t, 'category', value)}
            </option>
          ))}
        </select>
        <input
          className='bg-card border-divider min-w-56 flex-1 rounded border px-2 py-1.5 text-sm'
          onBlur={() => updateUrl({ subjectQuery: subjectQuery || null, page: '1' })}
          onChange={(event) => {
            setSubjectQuery(event.target.value)
            setPage(1)
            updateUrl({ subjectQuery: event.target.value || null, page: '1' }, 'replace')
          }}
          placeholder={t('dsb.activity.search_subject')}
          value={subjectQuery}
        />
        {selectedDay && (
          <button
            className='text-digest px-2 py-1.5 text-sm underline'
            onClick={() => {
              setSelectedDay(null)
              setPage(1)
              updateUrl({ selectedDay: null, page: '1' })
            }}
            type='button'
          >
            {t('dsb.activity.clear_day')}
          </button>
        )}
        {actorRef && (
          <button
            className='text-digest px-2 py-1.5 text-sm underline'
            onClick={() => changeFilter('actorRef', '', setActorRef)}
            type='button'
          >
            {t('dsb.activity.clear_actor')}
          </button>
        )}
        <button
          className={`text-digest px-2 py-1.5 text-sm underline ${highRiskOnly ? 'text-accent' : ''}`}
          onClick={() => {
            const next = !highRiskOnly
            setHighRiskOnly(next)
            setPage(1)
            updateUrl({ highRisk: next ? '1' : null, page: '1' })
          }}
          type='button'
        >
          {t('dsb.activity.high_risk')}
        </button>
        <button
          className='text-digest px-2 py-1.5 text-sm underline disabled:opacity-50'
          disabled={exporting}
          onClick={() => downloadExport('CSV')}
          type='button'
        >
          {t('dsb.activity.export_csv')}
        </button>
        <button
          className='text-digest px-2 py-1.5 text-sm underline disabled:opacity-50'
          disabled={exporting}
          onClick={() => downloadExport('JSON')}
          type='button'
        >
          {t('dsb.activity.export_json')}
        </button>
      </section>

      {newActivityCount > 0 && (
        <button
          className='bg-accent/10 text-accent rounded-md px-4 py-2 text-left text-sm'
          onClick={() => {
            setNewActivityCount(0)
            void activityQuery.refetch()
          }}
          type='button'
        >
          {t('dsb.activity.new_available')}
        </button>
      )}

      <section className='bg-card divide-divider border-divider divide-y rounded-md border'>
        {activityQuery.isError && (
          <div className='flex items-center justify-between gap-4 px-5 py-8'>
            <p className='text-digest text-sm'>{t('dsb.activity.load_error')}</p>
            <button
              className='text-accent text-sm underline'
              onClick={() => void activityQuery.refetch()}
              type='button'
            >
              {t('dsb.activity.retry')}
            </button>
          </div>
        )}
        {activityQuery.isPending && (
          <p className='text-digest px-5 py-8 text-sm'>{t('dsb.activity.loading')}</p>
        )}
        {!activityQuery.isPending && activityQuery.data?.entries.length === 0 && (
          <p className='text-digest px-5 py-8 text-sm'>{t('dsb.activity.empty')}</p>
        )}
        {operationGroups.map((dateGroup) => (
          <div key={dateGroup.key}>
            <h2 className='bg-hover text-digest px-5 py-2 text-xs font-semibold tracking-wide uppercase'>
              {dateGroup.label}
            </h2>
            {dateGroup.groups.map((group) => {
              if (group.entries.length === 1) return renderEntry(group.entries[0])

              const expanded = expandedOperations.has(group.key)
              return (
                <div key={group.key}>
                  <button
                    className='hover:bg-hover flex w-full items-center justify-between px-5 py-4 text-left transition-colors'
                    onClick={() =>
                      setExpandedOperations((current) => {
                        const next = new Set(current)
                        if (next.has(group.key)) next.delete(group.key)
                        else next.add(group.key)
                        return next
                      })
                    }
                    type='button'
                  >
                    <span className='text-sm'>
                      {activityMessage(t, group.entries[0])} ·{' '}
                      {t('dsb.activity.operation_events', { count: group.entries.length })}
                    </span>
                    <span className='text-digest text-xs'>
                      {expanded ? t('dsb.activity.collapse') : t('dsb.activity.expand')}
                    </span>
                  </button>
                  {expanded && group.entries.map(renderEntry)}
                </div>
              )
            })}
          </div>
        ))}
      </section>

      {statsQuery.isError && (
        <p className='text-digest text-sm'>{t('dsb.activity.overview_error')}</p>
      )}

      <nav className='flex items-center justify-between' aria-label={t('dsb.activity.pagination')}>
        <button
          className='text-digest px-2 py-1 text-sm underline disabled:opacity-40'
          disabled={pageNumber <= 1 || activityQuery.isFetching}
          onClick={() => {
            const next = pageNumber - 1
            setPage(next)
            updateUrl({ page: String(next) })
          }}
          type='button'
        >
          {t('dsb.activity.previous')}
        </button>
        <span className='text-digest text-sm'>
          {t('dsb.activity.page', { page: pageNumber, total: totalPages })}
        </span>
        <button
          className='text-digest px-2 py-1 text-sm underline disabled:opacity-40'
          disabled={pageNumber >= totalPages || activityQuery.isFetching}
          onClick={() => {
            const next = pageNumber + 1
            setPage(next)
            updateUrl({ page: String(next) })
          }}
          type='button'
        >
          {t('dsb.activity.next')}
        </button>
      </nav>

      {detailEntry && (
        <aside
          aria-labelledby='activity-detail-title'
          aria-modal='true'
          className='bg-card border-divider rounded-md border px-5 py-4'
          role='dialog'
        >
          <div className='flex items-start justify-between gap-4'>
            <div>
              <h2 className='text-base font-semibold' id='activity-detail-title'>
                {activityMessage(t, detailEntry)}
              </h2>
              <p className='text-digest mt-1 text-xs'>
                {new Date(String(detailEntry.occurredAt)).toLocaleString()} ·{' '}
                {activityValueLabel(t, 'source', detailEntry.source)}
              </p>
            </div>
            <button
              className='text-digest text-sm underline'
              onClick={() => {
                setSelectedEntry(null)
                updateUrl({ eventRef: null })
              }}
              type='button'
            >
              {t('dsb.activity.close')}
            </button>
          </div>
          <dl className='mt-4 grid gap-2 text-sm'>
            <div>
              <dt className='text-digest'>{t('dsb.activity.event_ref')}</dt>
              <dd className='break-all'>{detailEntry.eventRef || '—'}</dd>
            </div>
            <div>
              <dt className='text-digest'>{t('dsb.activity.operation_ref')}</dt>
              <dd className='break-all'>{detailEntry.operationRef || '—'}</dd>
            </div>
            <div>
              <dt className='text-digest'>{t('dsb.activity.parent_event_ref')}</dt>
              <dd className='break-all'>{detailEntry.parentEventRef || '—'}</dd>
            </div>
            <div>
              <dt className='text-digest'>{t('dsb.activity.actor')}</dt>
              <dd>
                <button
                  className='text-accent underline'
                  onClick={() => {
                    const ref = detailEntry.actor.id || detailEntry.actor.login || ''
                    setActorRef(ref)
                    setPage(1)
                    updateUrl({ actorRef: ref || null, page: '1' })
                  }}
                  type='button'
                >
                  {detailEntry.actor.nickname || detailEntry.actor.login || detailEntry.actor.type}
                </button>
              </dd>
            </div>
          </dl>
          {detailEntry.parentEventRef && (
            <div className='mt-3 text-xs'>
              <p className='text-digest'>{t('dsb.activity.parent_event')}</p>
              <p>
                {parentEntry ? activityMessage(t, parentEntry) : t('dsb.activity.loading_related')}
              </p>
            </div>
          )}
          {eventDetail && childEntries.length > 0 && (
            <div className='mt-3 text-xs'>
              <p className='text-digest'>{t('dsb.activity.child_events')}</p>
              <ul className='mt-1 space-y-1'>
                {childEntries.map((entry) => (
                  <li key={entry.id}>{activityMessage(t, entry)}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      )}
    </main>
  )
}
