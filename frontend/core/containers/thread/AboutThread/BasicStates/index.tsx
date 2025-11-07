import { type FC, memo } from 'react'

import Trend from 'react-trend'
import CommentSVG from '~/icons/Comment'
import EmojiSVG from '~/icons/Heart'
import PostSVG from '~/icons/Post'
import PulseSVG from '~/icons/Pulse'
import UserSVG from '~/icons/Users'

import useSalon, { cn } from '../salon/basic_states'

const BasicStates: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={cn(s.block, 'pl-0')}>
        <div className={cn(s.iconBox, s.greenBg)}>
          <PulseSVG className={cn(s.icon, s.greenFill)} />
        </div>
        <h4 className={s.title}>活跃度</h4>
        <div className={s.desc}>最近 30 天</div>
        <div className={s.trendChart}>
          <Trend
            smooth
            width={80}
            height={30}
            data={[2, 3, 6, 0, 2, 10, 8, 8, 22, 33, 2, 3, 4, 5, 6]}
            gradient={['yellowgreen', 'green']}
            radius={15}
            strokeWidth={1}
            strokeLinecap='round'
          />
        </div>
      </div>
      <div className={cn(s.block, 'pl-3')}>
        <div className={cn(s.iconBox, s.purpleBg)}>
          <PostSVG className={cn(s.icon, 'size-4', s.purpleFill)} />
        </div>
        <h4 className={s.title}>内容</h4>
        <div className={s.desc}>所有板块内容总和</div>
        <div className={s.num}>12k</div>
      </div>

      <div className={cn(s.block, 'pl-6')}>
        <div className={cn(s.iconBox, s.blueBg)}>
          <CommentSVG className={cn(s.icon, 'size-3', s.blueFill)} />
        </div>
        <h4 className={s.title}>评论</h4>
        <div className={s.desc}>所有评论总和</div>
        <div className={s.num}>237</div>
      </div>
      <div className={cn(s.block, 'pl-7')}>
        <div className={cn(s.iconBox, s.orangeBg)}>
          <UserSVG className={cn(s.icon, s.orangeFill)} />
        </div>
        <h4 className={s.title}>互动人数</h4>
        <div className={s.desc}>参与互动的用户</div>
        <div className={s.num}>28</div>
      </div>
      <div className={cn(s.block, 'pl-12')}>
        <div className={cn(s.iconBox, s.redBg)}>
          <EmojiSVG className={cn(s.icon, s.redFill)} />
        </div>

        <h4 className={s.title}>表情</h4>
        <div className={s.desc}>投票和表情</div>
        <div className={s.num}>374</div>
      </div>
    </div>
  )
}

export default memo(BasicStates)
