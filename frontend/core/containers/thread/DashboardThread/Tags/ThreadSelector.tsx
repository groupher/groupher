import Button from '~/widgets/Buttons/Button'

import useTags from '../logic/useTags'
import useSalon, { cn } from '../salon/tags/thread_selector'

export default () => {
  const s = useSalon()

  const { activeTagThread, changeThread, getThreads } = useTags()
  const active = activeTagThread

  return (
    <div className={s.wrapper}>
      <label className={s.hint}>社区板块:</label>
      <div className={s.cardsWrapper}>
        {getThreads().map((thread) => (
          <Button
            key={thread.slug}
            size="small"
            className={cn('w-20', thread.slug !== active && 'saturate-0')}
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
