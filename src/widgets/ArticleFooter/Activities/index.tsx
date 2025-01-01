import { mockUsers } from '~/mock'

import Img from '~/Img'
import ImgFallback from '~/widgets/ImgFallback'

import TagItem from './TagItem'
import GtdItem from './GtdItem'
import MentionItem from './MentionItem'

import useSalon, { cn } from '../salon/activities'

export default () => {
  const s = useSalon()

  const user = mockUsers(1)[0]

  return (
    <div className={s.wrapper}>
      <div className={s.item}>
        <div className={cn(s.tail, '-bottom-3.5 h-2.5')} />
        <Img
          src={user.avatar}
          className={s.avatar}
          fallback={<ImgFallback size={18} user={user} left={-3} />}
        />

        <div className={s.content}>
          <span className={cn(s.highlight, 'mr-1')}>mydearxym</span>
          发布于 3 天前
        </div>
      </div>

      <TagItem />
      <GtdItem />
      <MentionItem />

      <div className={s.lastUpdate}>最后回复: 14天前</div>
    </div>
  )
}
