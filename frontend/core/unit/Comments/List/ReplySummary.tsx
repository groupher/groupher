import SIZE from '~/const/size'
import useTrans from '~/hooks/useTrans'
import type { TUser } from '~/spec'
import Facepile from '~/ui/Facepile'
import TimeAgo from '~/ui/TimeAgo'

import useSalon from './salon/reply_summary'

type TProps = {
  participants: readonly TUser[]
  count: number
  lastReplyAt?: string | null
  expanded: boolean
  onToggle: () => void
}

/** A bounded participant snapshot and effective reply count open the full reply history. */
export default function ReplySummary({
  participants,
  count,
  lastReplyAt,
  expanded,
  onToggle,
}: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const label =
    count > 0
      ? `${count} ${t(count === 1 ? 'comment.replies.one' : 'comment.replies.count')}`
      : t('comment.replies.records')
  return (
    <div className={s.wrapper}>
      <div className={s.content} aria-hidden>
        <Facepile
          users={[...participants]}
          limit={4}
          size={SIZE.MEDIUM}
          showMore={false}
          cardMode='static'
        />
        <span className={s.count}>{label}</span>
        {lastReplyAt && (
          <>
            <span className={s.separator}>•</span>
            <span className={s.lastReply}>
              {t('comment.replies.last')} <TimeAgo datetime={lastReplyAt} />
            </span>
          </>
        )}
      </div>
      <button type='button' className={s.control} aria-expanded={expanded} onClick={onToggle}>
        <span className='sr-only'>
          {label} · {t(expanded ? 'comment.replies.collapse' : 'comment.replies.expand')}
        </span>
      </button>
    </div>
  )
}
