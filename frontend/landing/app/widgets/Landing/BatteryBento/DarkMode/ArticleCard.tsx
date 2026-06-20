import type { FC } from 'react'

import UpvoteSVG from '~/icons/Upvote'
import type { TThemeName } from '~/spec'

import useSalon, { cn } from '../../salon/battery_bento/dark_mode/article_card'
import { cnMerge } from '~/css'

type TProps = {
  className?: string
  theme?: TThemeName
}

const ArticleCard: FC<TProps> = ({ className = '', theme }) => {
  const s = useSalon()

  return (
    <div className={cnMerge(s.wrapper, className)} data-theme={theme}>
      <h4 className={s.title}>AI 辅助总结</h4>
      <div className={s.codeBox}>
        <div className={s.codeItem}>
          <div className={s.bar} />
          <div className={cn(s.bar, 'w-5')} />
          <div className={cn(s.bar, 'w-3')} />
        </div>

        <div className={s.codeItem}>
          <div className={cn(s.bar, 'w-12')} />
          <div className={cn(s.bar, 'w-5')} />
          <div className={cn(s.bar, 'w-2')} />
        </div>
        <div className={s.codeItem}>
          <div className={cn(s.bar, 'w-3')} />
          <div className={cn(s.bar, 'w-2')} />
          <div className={cn(s.bar, 'w-14')} />
        </div>

        <div className={s.codeItem}>
          <div className={cn(s.bar, 'w-3')} />
          <div className={cn(s.bar, 'w-10')} />
          <div className={cn(s.bar, 'w-2')} />
        </div>
      </div>
      <div className={s.footer}>
        <UpvoteSVG className={s.upvoteIcon} />
        <div className={s.count}>65</div>
      </div>
    </div>
  )
}

export default ArticleCard
