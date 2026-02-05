import { type FC, memo } from 'react'
import useTrans from '~/hooks/useTrans'
import Img from '~/Img'
import useSalon, { cn } from '../../salon/content/fake_browser/content'
import type { TCommunityType } from '../../spec'
import communityIntros from '../communityIntros'

type TProps = {
  title?: string
  desc?: string
  logo?: string | null
  communityType: TCommunityType
  onHoverThread: (thread: string) => void
}

const Content: FC<TProps> = ({ title = '', desc = '', logo, communityType, onHoverThread }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.banner}>
        <div className='row-center'>
          {logo ? <Img src={logo} className={s.logo} /> : <div className={s.bar} />}
          {title ? (
            <div className={s.title}>{title}</div>
          ) : (
            <div className={cn(s.title, 'opacity-50')}>{t('community.editor.your.community')}</div>
          )}
        </div>
        {communityType && (
          <div className={s.threads}>
            {communityIntros[communityType].threads.map((thread) => (
              <button
                key={thread}
                className={s.threadItem}
                onMouseOver={() => onHoverThread(thread)}
                onFocus={() => onHoverThread(thread)}
              >
                {thread}
              </button>
            ))}
          </div>
        )}
        <div className={cn(s.bar, 'size-4')} />
      </div>
      <div className={s.desc}>{desc}</div>
      <div className={cn(s.tags, desc && 'top-32')}>
        <div className={cn(s.feedBar, 'w-32')} />
        <div className={cn(s.feedBar, 'w-28')} />
        <div className={cn(s.feedBar, 'w-24')} />
        <div className={cn(s.feedBar, 'w-32')} />
      </div>
      <div className={s.feeds}>
        <div className={s.feedBar} />
        <div className={cn(s.feedBar, 'w-72')} />
        <div className={cn(s.feedBar, 'w-64')} />
        <div className={s.feedBar} />
        <div className={cn(s.feedBar, 'w-52')} />
        <div className={s.feedBar} />
        <div className={cn(s.feedBar, 'w-48')} />
      </div>
    </div>
  )
}

export default memo(Content)
