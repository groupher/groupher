import type { FC } from 'react'
import { ARTICLE_CAT } from '~/const/gtd'
import useTrans from '~/hooks/useTrans'
import Img from '~/Img'
import BugSVG from '~/icons/Bug'
import ClipSVG from '~/icons/Clip'
import DiscussSVG from '~/icons/Discuss'
import TagSVG from '~/icons/HashTag'
import LightSVG from '~/icons/Light'
import PinSVG from '~/icons/Pin'
import QuestionSVG from '~/icons/Question'
import TargetSVG from '~/icons/TargetBold'
import ToolSVG from '~/icons/Tool'
import { mockUsers } from '~/mock'
import type { TArticleCat, TColorName } from '~/spec'

import Facepile from '~/widgets/Facepile/LandingPage'
import useSalon, { cn } from '../../salon/compare_dev/our_way/node_block'
import { getMetricMap } from '../constant'
import SprintCounter from './SprintCounter'
import UpdateCounter from './UpdateCounter'

type TProps = {
  cat?: TArticleCat | 'DEFAULT'
  index?: number
  className?: string
  rightDot?: string
  leftDot?: string
  bg?: TColorName
}

const NodeBlock: FC<TProps> = ({
  cat = 'DEFAULT',
  index = -1,
  className = '',
  bg = null,
  leftDot = 'bottom-4',
  rightDot = 'bottom-4',
}) => {
  const s = useSalon({ bgColor: bg })
  const { t } = useTrans()
  const users = mockUsers(10)

  const metric = getMetricMap(t)[cat]

  return (
    <div className={cn(s.wrapper, className, cat === 'DEFAULT' && 'h-32')}>
      {cat === ARTICLE_CAT.FEATURE && <ClipSVG className={s.attachIcon} />}
      {cat === ARTICLE_CAT.QUESTION && (
        <PinSVG className={cn(s.attachIcon, 'rotate-12 size-5 -top-2')} />
      )}
      {cat === ARTICLE_CAT.BUG && <TargetSVG className={s.attachIcon} />}
      {cat === ARTICLE_CAT.OTHER && <TagSVG className={cn(s.attachIcon, 'rotate-12')} />}

      {cat === ARTICLE_CAT.BUG && (
        <div className={cn(s.avatarGroup, 'top-4 right-4 rotate-6 opacity-65')}>
          <Facepile users={users.slice(3, 5)} left={2} className='scale-90 gap-x-1' />
        </div>
      )}

      {cat === ARTICLE_CAT.FEATURE && (
        <div className={cn(s.userWrapper, s.borderPurple, 'top-5 right-4')}>
          <Img src={users[6].avatar} className={cn(s.avatar, 'size-7')} />
        </div>
      )}

      {cat === ARTICLE_CAT.OTHER && (
        <div className={cn(s.avatarGroup, 'top-3.5 right-4 -rotate-3 opacity-65')}>
          <Facepile users={users.slice(0, 2)} left={2} className='scale-90 gap-x-1' />
        </div>
      )}

      {cat === 'DEFAULT' && index === 0 && <div className={cn(s.leftDot, leftDot)} />}

      <div className={cn(s.rightDot, rightDot)} />

      <div className={s.header}>
        {cat === ARTICLE_CAT.FEATURE && <LightSVG className={s.headIcon} />}
        {cat === ARTICLE_CAT.QUESTION && <QuestionSVG className={s.headIcon} />}
        {cat === ARTICLE_CAT.BUG && <BugSVG className={s.headIcon} />}
        {cat === ARTICLE_CAT.OTHER && <DiscussSVG className={s.headIcon} />}
        {cat === 'DEFAULT' && <ToolSVG className={cn(s.headIcon, 'size-2.5 opacity-80')} />}

        <div className={s.text}>{metric.title}</div>
      </div>
      <div className={cn(s.innerCard, cat === 'DEFAULT' && 'h-20')}>
        <div className={cn(s.bar, 'w-24')} />
        <div className={cn(s.bar)} />

        <div className='grow' />
        <div className={s.footer}>
          {cat === 'DEFAULT' ? (
            <SprintCounter num={metric.upvoteNum + index + 20} />
          ) : (
            <UpdateCounter text={metric.upvoteText} num={metric.upvoteNum} color={bg} />
          )}
          <div className='grow' />
        </div>
      </div>
    </div>
  )
}

export default NodeBlock
