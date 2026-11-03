import { communityQueries } from '@community/query/queries'
import { communityPublicPath } from '@community/server/public-path'
import { createFileRoute, notFound } from '@tanstack/react-router'

import { THREAD } from '~/const/thread'
import useTrans from '~/hooks/useTrans'
import { loadTicketSourceStats } from '~/query/ticketStats'
import type { TTicket } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import CommunityPreviewLink from '~/ui/CommunityPreviewLink'
import ReferenceMap from '~/unit/ReferenceMap'

const STATUS_LABEL = {
  TODO: 'article.status.todo',
  WIP: 'article.status.wip',
  DONE: 'article.status.done',
} as const

export const Route = createFileRoute('/$community/ticket/$id')({
  loader: async ({ context, params }) => {
    const innerId = Number(params.id)
    if (!Number.isInteger(innerId) || innerId < 1) throw notFound()
    const ticket = await context.queryClient.ensureQueryData(
      communityQueries.ticket(params.community, innerId),
    )
    if (!ticket) throw notFound()
    const publicTicket = ticket as unknown as TTicket
    const postInnerIds = Array.from(
      new Set(
        publicTicket.sources.flatMap((source) => (source.innerId === null ? [] : [source.innerId])),
      ),
    )
    const postStats = postInnerIds.length
      ? await loadTicketSourceStats(postInnerIds, (batch) =>
          context.queryClient.ensureQueryData(
            communityQueries.stats(context.queryClient, params.community, THREAD.POST, batch),
          ),
        )
      : []
    return {
      ticket: publicTicket,
      stats: {
        upvotesCount: postStats.reduce((sum, stats) => sum + stats.upvotesCount, 0),
        commentsCount: postStats.reduce((sum, stats) => sum + stats.commentsCount, 0),
        views: postStats.reduce((sum, stats) => sum + stats.views, 0),
      },
    }
  },
  head: ({ loaderData, params, matches }) => ({
    meta: loaderData?.ticket.title ? [{ title: loaderData.ticket.title }] : [],
    links: [
      {
        rel: 'canonical',
        href: communityPublicPath(params.community, `/ticket/${params.id}`, matches),
      },
    ],
  }),
  component: TicketDetail,
})

function TicketDetail() {
  const { ticket, stats } = Route.useLoaderData()
  const { slug } = useCommunity()
  const { t } = useTrans()
  const statusLabel = STATUS_LABEL[ticket.status as keyof typeof STATUS_LABEL]

  return (
    <article className='mx-auto w-full max-w-3xl px-5 py-10'>
      <div className='mb-4 flex items-center gap-3 text-sm'>
        <span className='text-digest font-mono'>#{ticket.innerId}</span>
        <span className='bg-hoverBg rounded px-2 py-1'>
          {statusLabel ? t(statusLabel) : ticket.status}
        </span>
      </div>
      <h1 className='text-3xl font-semibold'>{ticket.title}</h1>
      {ticket.digest && <p className='text-digest mt-4 text-lg'>{ticket.digest}</p>}
      <div className='text-digest mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm'>
        <span>{t('ticket.stats.upvotes', { count: stats.upvotesCount })}</span>
        <span>{t('ticket.stats.comments', { count: stats.commentsCount })}</span>
        <span>{t('ticket.stats.views', { count: stats.views })}</span>
        <span>{t('ticket.original_posts', { count: ticket.sources.length })}</span>
      </div>
      <section className='border-divider mt-6 border-t pt-4'>
        <h2 className='text-sm font-medium'>{t('ticket.public.plan')}</h2>
        <p className='text-digest mt-1 text-sm'>
          {ticket.plannedStartAt && ticket.plannedEndAt
            ? `${ticket.plannedStartAt.slice(0, 10)} – ${ticket.plannedEndAt.slice(0, 10)}`
            : t('ticket.public.unscheduled')}
        </p>
      </section>
      {ticket.plainText && (
        <div className='mt-8 leading-7 whitespace-pre-wrap'>{ticket.plainText}</div>
      )}
      {ticket.sources.length > 0 && (
        <section className='border-divider mt-10 border-t pt-5'>
          <h2 className='mb-3 text-sm font-medium'>
            {t('ticket.original_posts', { count: ticket.sources.length })}
          </h2>
          <ul className='space-y-2'>
            {ticket.sources.map((source) => (
              <li key={source.id}>
                <CommunityPreviewLink
                  href={`/${slug}/post/${source.innerId}`}
                  previewId={String(source.innerId ?? source.id)}
                  className='text-accent hover:underline'
                >
                  {source.title || `Post #${source.innerId}`}
                </CommunityPreviewLink>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className='border-divider mt-10 border-t pt-5'>
        <h2 className='mb-3 text-sm font-medium'>{t('ticket.public.updates')}</h2>
        {ticket.updates.filter((update) => update.visibility === 'PUBLIC').length > 0 ? (
          <ol className='space-y-4'>
            {ticket.updates
              .filter((update) => update.visibility === 'PUBLIC')
              .map((update) => (
                <li key={update.id} className='border-divider border-l-2 pl-3'>
                  {update.publishedAt && (
                    <time className='text-digest text-xs' dateTime={update.publishedAt}>
                      {update.publishedAt.slice(0, 10)}
                    </time>
                  )}
                  <p className='mt-1 text-sm leading-6 whitespace-pre-wrap'>{update.body}</p>
                </li>
              ))}
          </ol>
        ) : (
          <p className='text-digest text-sm'>{t('ticket.public.no_updates')}</p>
        )}
      </section>
      <ReferenceMap
        community={slug}
        focus={{ type: 'TICKET', articleInnerId: String(ticket.innerId) }}
      />
    </article>
  )
}
