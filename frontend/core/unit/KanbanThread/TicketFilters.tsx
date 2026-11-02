'use client'

import { useQuery } from '@tanstack/react-query'
import type { ChangeEvent } from 'react'

import useTrans from '~/hooks/useTrans'
import { ticketQueries } from '~/query/ticket'
import type { TTicketFilter } from '~/spec'
import useCommunity from '~/stores/community/hooks'

import useSalon from './salon/ticket_filters'

type TProps = {
  value: TTicketFilter
  onChange: (value: TTicketFilter) => void
}

const splitValues = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  )

const toBoundary = (value: string, endOfDay = false): string | undefined =>
  value
    ? new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`).toISOString()
    : undefined

export default function TicketFilters({ value, onChange }: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const { slug } = useCommunity()
  const assignees = useQuery(ticketQueries.assigneeCandidates(slug))
  const tagGroups = useQuery(ticketQueries.tagGroups(slug))
  const tags = (tagGroups.data || [])
    .flatMap((group) => group?.tags || [])
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))

  const update = <K extends keyof TTicketFilter>(key: K, next: TTicketFilter[K] | undefined) => {
    const updated = { ...value }
    if (next === undefined || next === '') delete updated[key]
    else updated[key] = next
    onChange(updated)
  }

  const updateDate = (key: keyof TTicketFilter, event: ChangeEvent<HTMLInputElement>) => {
    const value = toBoundary(
      event.currentTarget.value,
      key.endsWith('Before') || key === 'plannedBefore',
    )
    update(key, value)
  }

  return (
    <section className={s.wrapper} aria-label={t('ticket.filter.title')}>
      <label className={s.label}>
        {t('ticket.filter.view')}
        <select
          className={s.control}
          value={value.type || 'USER'}
          onChange={(event) => update('type', event.target.value as 'USER' | 'CASE')}
        >
          <option value='USER'>{t('ticket.filter.user_tickets')}</option>
          <option value='CASE'>{t('ticket.filter.cases')}</option>
        </select>
      </label>

      <label className={s.label}>
        {t('ticket.filter.assignee')}
        <select
          className={s.control}
          value={value.assigneeId ?? ''}
          onChange={(event) =>
            update('assigneeId', event.target.value ? Number(event.target.value) : undefined)
          }
        >
          <option value=''>{t('ticket.filter.any')}</option>
          {(assignees.data || []).map((user) => (
            <option key={user.id} value={user.id}>
              {user.nickname || user.login}
            </option>
          ))}
        </select>
      </label>

      <label className={s.label}>
        {t('ticket.filter.priority')}
        <select
          className={s.control}
          value={value.priority ?? ''}
          onChange={(event) =>
            update('priority', event.target.value ? Number(event.target.value) : undefined)
          }
        >
          <option value=''>{t('ticket.filter.any')}</option>
          {[0, 1, 2, 3].map((priority) => (
            <option key={priority} value={priority}>
              P{priority}
            </option>
          ))}
        </select>
      </label>

      <label className={s.label}>
        {t('ticket.filter.tags')}
        <select
          className={s.control}
          multiple
          value={(value.tagIds || []).map(String)}
          onChange={(event) =>
            update(
              'tagIds',
              Array.from(event.currentTarget.selectedOptions, (option) => Number(option.value)),
            )
          }
        >
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.title}
            </option>
          ))}
        </select>
      </label>

      <label className={s.label}>
        {t('ticket.filter.version')}
        <input
          className={s.control}
          value={(value.versions || []).join(', ')}
          onChange={(event) => update('versions', splitValues(event.currentTarget.value))}
        />
      </label>

      <label className={s.label}>
        {t('ticket.filter.os')}
        <input
          className={s.control}
          value={(value.operatingSystems || []).join(', ')}
          onChange={(event) => update('operatingSystems', splitValues(event.currentTarget.value))}
        />
      </label>

      <label className={s.label}>
        {t('ticket.filter.module')}
        <input
          className={s.control}
          value={(value.modules || []).join(', ')}
          onChange={(event) => update('modules', splitValues(event.currentTarget.value))}
        />
      </label>

      <label className={s.label}>
        {t('ticket.filter.created_after')}
        <input
          className={s.control}
          type='date'
          value={value.createdAfter?.slice(0, 10) || ''}
          onChange={(event) => updateDate('createdAfter', event)}
        />
      </label>

      <label className={s.label}>
        {t('ticket.filter.created_before')}
        <input
          className={s.control}
          type='date'
          value={value.createdBefore?.slice(0, 10) || ''}
          onChange={(event) => updateDate('createdBefore', event)}
        />
      </label>

      <label className={s.label}>
        {t('ticket.filter.updated_after')}
        <input
          className={s.control}
          type='date'
          value={value.updatedAfter?.slice(0, 10) || ''}
          onChange={(event) => updateDate('updatedAfter', event)}
        />
      </label>

      <label className={s.label}>
        {t('ticket.filter.updated_before')}
        <input
          className={s.control}
          type='date'
          value={value.updatedBefore?.slice(0, 10) || ''}
          onChange={(event) => updateDate('updatedBefore', event)}
        />
      </label>

      <label className={s.label}>
        {t('ticket.filter.planned_after')}
        <input
          className={s.control}
          type='date'
          value={value.plannedAfter?.slice(0, 10) || ''}
          onChange={(event) => updateDate('plannedAfter', event)}
        />
      </label>

      <label className={s.label}>
        {t('ticket.filter.planned_before')}
        <input
          className={s.control}
          type='date'
          value={value.plannedBefore?.slice(0, 10) || ''}
          onChange={(event) => updateDate('plannedBefore', event)}
        />
      </label>

      <button type='button' className={s.clear} onClick={() => onChange({})}>
        {t('ticket.filter.clear')}
      </button>
    </section>
  )
}
