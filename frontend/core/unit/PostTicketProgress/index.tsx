import type { FC } from 'react'

import { ARTICLE_CAT, ARTICLE_STATUS } from '~/const/gtd'
import { aliasGTDDoneStatus } from '~/fmt'
import useTrans from '~/hooks/useTrans'
import type { TArticleCat, TPostTicketProgress } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import CommunityPreviewLink from '~/ui/CommunityPreviewLink'

type TProps = {
  progress?: TPostTicketProgress | null
  cat?: TArticleCat | null
}

const PostTicketProgress: FC<TProps> = ({ progress, cat }) => {
  const { slug } = useCommunity()
  const { t } = useTrans()
  if (!progress) return null

  const label =
    progress.status === 'DONE'
      ? t(aliasGTDDoneStatus(cat ?? ARTICLE_CAT.DISCUSSION, ARTICLE_STATUS.DONE))
      : t(progress.status === 'TODO' ? 'ticket.progress.todo' : 'ticket.progress.wip')

  return (
    <div className='row-center text-digest gap-1.5 text-xs'>
      <span>{label}</span>
      {progress.total > 1 && <span>{`${progress.completed}/${progress.total}`}</span>}
      <span className='row-center gap-1'>
        {progress.tickets.map((ticket) => (
          <CommunityPreviewLink
            key={ticket.id}
            href={`/${slug}/ticket/${ticket.innerId}`}
            previewId={String(ticket.innerId)}
            className='text-accent hover:underline'
          >
            #{ticket.innerId} · {ticket.title}
          </CommunityPreviewLink>
        ))}
      </span>
    </div>
  )
}

export default PostTicketProgress
