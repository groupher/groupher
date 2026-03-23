import useTrans from '~/hooks/useTrans'
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
            className={cn(thread.slug !== active && 'saturate-0')}
            noBorder={thread.slug !== active}
            onClick={() => changeThread(thread.slug)}
            ghost
          >
            {thread.title}
          </Button>
        ))}
      </div>
    </div>
  )
}
