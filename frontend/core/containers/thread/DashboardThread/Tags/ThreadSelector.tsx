import Button from '~/widgets/Buttons/Button'

import useTags from '../logic/useTags'
import useSalon, { cn } from '../salon/tags/thread_selector'

export default () => {
  const s = useSalon()

  const { activeTagThread, changeThread, threads } = useTags()
  const active = activeTagThread

  return (
    <div className={s.wrapper}>
      <div className={s.hint}>社区板块:</div>
      <div className={s.cardsWrapper}>
        {threads.map((thread) => (
          <Button
            key={thread.slug}
            size='small'
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
