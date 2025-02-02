import type { FC } from 'react'

import UpvoteSVG from '~/icons/Upvote'

import useSalon, { cn } from '../../salon/battery_bento/dark_mode/article_card'

type TProps = {
  hovering: boolean
  className?: string
}

const ArticleCard: FC<TProps> = ({ hovering, className = '' }) => {
  const s = useSalon({ hovering })

  return (
    <div className={cn(s.wrapper, className)}>
      <h4 className={s.title}>AI 辅助总结</h4>
      <div className={s.codeBox}>
        <div className={s.codeItem}>
          <div className={cn(s.bar)} />
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
