import type { FC } from 'react'

import { DSB_ROUTE } from '~/constant/route'
import useTrans from '~/hooks/useTrans'
import { Link as PlatformLink } from '~/platform'
import type { TTicketViewModel } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import CommunityPreviewLink from '~/ui/CommunityPreviewLink'

import useSalon from './salon/ticket_card'

type TProps = {
  viewModel: TTicketViewModel
  internal?: boolean
}

const STATUS_LABEL = {
  TODO: 'article.status.todo',
  WIP: 'article.status.wip',
  DONE: 'article.status.done',
} as const

const TicketCard: FC<TProps> = ({ viewModel, internal = false }) => {
  const { slug } = useCommunity()
  const { t } = useTrans()
  const s = useSalon()
  const { content: ticket, stats } = viewModel
  const label = STATUS_LABEL[ticket.status as keyof typeof STATUS_LABEL]

  return (
    <article className={s.wrapper}>
      <div className={s.meta}>
        <span className={s.number}>#{ticket.innerId}</span>
        <span className={s.status}>{label ? t(label) : ticket.status}</span>
      </div>
      {internal ? (
        <PlatformLink
          route={{
            app: 'dsb',
            community: slug,
            path: `${DSB_ROUTE.KANBAN}/ticket/${ticket.id}`,
          }}
          navigation='router'
          className={s.title}
        >
          {ticket.title}
        </PlatformLink>
      ) : (
        <CommunityPreviewLink
          href={`/${slug}/ticket/${ticket.innerId}`}
          className={s.title}
          previewId={String(ticket.innerId ?? ticket.id)}
        >
          {ticket.title}
        </CommunityPreviewLink>
      )}
      {ticket.digest && <p className={s.digest}>{ticket.digest}</p>}
      {ticket.plannedStartAt && ticket.plannedEndAt && (
        <p className={s.digest}>
          {t('ticket.card.planned_range', {
            start: ticket.plannedStartAt.slice(0, 10),
            end: ticket.plannedEndAt.slice(0, 10),
          })}
        </p>
      )}
      <div className={s.footer}>
        <span>{t('ticket.stats.upvotes', { count: stats.upvotesCount })}</span>
        <span>{t('ticket.stats.comments', { count: stats.commentsCount })}</span>
        <span>{t('ticket.stats.views', { count: stats.views })}</span>
        {ticket.sources.length > 0 && (
          <span>{t('ticket.original_posts', { count: ticket.sources.length })}</span>
        )}
      </div>
      {ticket.sources.length > 0 && (
        <ul className={s.posts}>
          {ticket.sources.slice(0, 2).map((source) => (
            <li key={source.id}>
              <CommunityPreviewLink
                href={`/${slug}/post/${source.innerId}`}
                previewId={String(source.innerId ?? source.id)}
                className={s.postLink}
              >
                {source.title || `Post #${source.innerId}`}
              </CommunityPreviewLink>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

export default TicketCard
