import useTrans from '~/hooks/useTrans'
import { path2Thread } from '~/utils/thread'
import Button from '~/widgets/Buttons/Button'

import useTags from '../logic/useTags'
import useSalon, { cn } from '../salon/tags/thread_selector'

export default function ThreadSelector() {
  const s = useSalon()
  const { t } = useTrans()

  const { activeTagThread, changeThread, threads } = useTags()
  const active = activeTagThread

  return (
    <div className={s.wrapper}>
      <div className={s.hint}>{t('dsb.tags.thread.label')}</div>
      <div className={s.cardsWrapper}>
        {threads.map((thread) => (
          <Button
            key={thread.slug}
            size='small'
            className={cn(path2Thread(thread.slug) !== active && 'saturate-0')}
            noBorder={path2Thread(thread.slug) !== active}
            onClick={() => changeThread(path2Thread(thread.slug))}
            ghost
          >
            {thread.title}
          </Button>
        ))}
      </div>
    </div>
  )
}
