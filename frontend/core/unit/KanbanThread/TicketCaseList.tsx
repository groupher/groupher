'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { DSB_ROUTE } from '~/constant/route'
import useTrans from '~/hooks/useTrans'
import { toPagiGraphQLInput } from '~/lib/pagination/params'
import { Link as PlatformLink } from '~/platform'
import { ticketQueries } from '~/query/ticket'
import type { TTicketFilter } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import Button from '~/ui/Buttons/Button'

import useSalon from './salon/ticket_case_list'

export default function TicketCaseList({ filter }: { filter: TTicketFilter }) {
  const s = useSalon()
  const { t } = useTrans()
  const { slug } = useCommunity()
  const [page, setPage] = useState(1)
  const pagi = toPagiGraphQLInput({ api: 'offset', page, size: 20 })
  const query = useQuery(ticketQueries.internalPage(slug, { ...filter, type: 'CASE' }, pagi))
  const pageInfo = query.data?.pageInfo
  const totalPages = pageInfo?.__typename === 'OffsetPageInfo' ? pageInfo.totalPages : 0

  return (
    <section className={s.wrapper}>
      <header className={s.header}>
        <h2 className={s.title}>{t('ticket.filter.cases')}</h2>
        <span className={s.count}>
          {pageInfo?.__typename === 'OffsetPageInfo' ? pageInfo.totalCount : 0}
        </span>
      </header>
      {query.isPending && <p className={s.muted}>{t('ticket.case_list.loading')}</p>}
      {query.isError && <p className={s.muted}>{t('ticket.management.failed')}</p>}
      {!query.isPending && query.data?.entries.length === 0 && (
        <p className={s.muted}>{t('ticket.case_list.empty')}</p>
      )}
      <div className={s.rows}>
        {query.data?.entries.map((ticket) => (
          <PlatformLink
            key={ticket.id}
            route={{
              app: 'dsb',
              community: slug,
              path: `${DSB_ROUTE.KANBAN}/ticket/${ticket.id}`,
            }}
            navigation='router'
            className={s.row}
          >
            <span className={s.status}>{ticket.status}</span>
            <span className={s.caseTitle}>{ticket.title}</span>
            <span className={s.muted}>
              {t('ticket.case_list.members', { count: ticket.members.length })}
            </span>
          </PlatformLink>
        ))}
      </div>
      {totalPages > 1 && (
        <footer className={s.footer}>
          <Button size='small' ghost disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t('common.previous_page')}
          </Button>
          <span className={s.muted}>
            {page} / {totalPages}
          </span>
          <Button
            size='small'
            ghost
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            {t('common.next_page')}
          </Button>
        </footer>
      )}
    </section>
  )
}
