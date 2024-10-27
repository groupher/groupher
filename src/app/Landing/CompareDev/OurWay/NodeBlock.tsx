import type { FC } from 'react'

import type { TArticleCat, TColorName } from '~/spec'
import { ARTICLE_CAT } from '~/const/gtd'

import { METRIC } from '../constant'
import UpdateCounter from './UpdateCounter'
import SprintCounter from './SprintCounter'

import PinSVG from '~/icons/Pin'
import TagSVG from '~/icons/HashTag'
import TargetSVG from '~/icons/TargetBold'
import ClipSVG from '~/icons/Clip'

import LightSVG from '~/icons/Light'
import BugSVG from '~/icons/Bug'
import QuestionSVG from '~/icons/Question'
import DiscussSVG from '~/icons/Discuss'
import ToolSVG from '~/icons/Tool'

import useSalon, { cn } from '../../salon/compare_dev/our_way/node_block'

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

  const metric = METRIC[cat]

  return (
    <div className={cn(s.wrapper, className, cat === 'DEFAULT' && 'h-32')}>
      {cat === ARTICLE_CAT.FEATURE && <ClipSVG className={s.attachIcon} />}
      {cat === ARTICLE_CAT.QUESTION && <PinSVG className={cn(s.attachIcon, 'rotate-12')} />}
      {cat === ARTICLE_CAT.BUG && <TargetSVG className={s.attachIcon} />}
      {cat === ARTICLE_CAT.OTHER && <TagSVG className={cn(s.attachIcon, 'rotate-12')} />}

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

        <div className="grow" />
        <div className={s.footer}>
          {cat === 'DEFAULT' ? (
            <SprintCounter num={metric.upvoteNum + index + 20} />
          ) : (
            <UpdateCounter text={metric.upvoteText} num={metric.upvoteNum} color={bg} />
          )}
          <div className="grow" />
        </div>
      </div>
    </div>
  )
}

export default NodeBlock
