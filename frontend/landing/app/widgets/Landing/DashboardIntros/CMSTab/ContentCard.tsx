import { COLOR } from '~/const/colors'
import AuthSVG from '~/icons/Account'
import CurveLineSVG from '~/icons/CurveLine'
import PostSVG from '~/icons/Post'
import WebhookSVG from '~/icons/Webhook'
import { mockUsers } from '~/mock'
import ArticleCatState from '~/unit/article-cat-state'
import CommentsCount from '~/unit/comments-count'
import Checker from '~/widgets/Checker'
import Facepile from '~/widgets/Facepile/LandingPage'

import useSalon, { cn } from '../../salon/dashboard_intros/cms_tab/content_card'

export default function ContentCard() {
  const s = useSalon()

  const users = mockUsers(3)

  return (
    <div className={s.wrapper}>
      <div className={cn(s.tip, 'top-24 left-20')}>
        <AuthSVG className={s.tipLogo} />
        支持先审核后发布
      </div>
      <div className={cn(s.tip, 'top-36 left-16')}>
        <WebhookSVG className={s.tipLogo} />
        Webhook 回调
      </div>
      <div className={cn(s.tip, 'top-48 left-12')}>
        <PostSVG className={s.tipLogo} />
        日志追溯
      </div>

      <CurveLineSVG className={s.curveLine} />
      <div className={s.item}>
        <div className={s.falseChecker} />
        <div className={s.bar} />
      </div>

      <div className={cn(s.item, s.itemGrey)}>
        <div className={s.falseChecker} />
        <div className={s.bar} />
      </div>

      <div className={s.item}>
        <div className={s.falseChecker} />
        <div className={s.bar} />
      </div>

      <div className={cn(s.item, s.itemGrey)}>
        <div className={s.falseChecker} />
        <div className={s.bar} />
      </div>

      <div className={s.item}>
        <div className={s.falseChecker} />
        <div className={s.bar} />
      </div>

      <div className={s.item}>
        <div className={s.falseChecker} />
        <div className={s.bar} />
      </div>
      <div className={cn(s.item, s.itemBlue, 'opacity-70 pl-6')}>
        <Checker checked size='small' color={COLOR.BLUE} />
        <div className={s.title}>支持离线同步</div>
        <ArticleCatState left={2} right={3} />
        <CommentsCount count={8} size='medium' left={3} right={4} />

        <Facepile users={users} className='scale-90 -mt-0.5' />
      </div>
      <div className={s.item}>
        <div className={s.falseChecker} />
        <div className={s.bar} />
      </div>
      <div className={cn(s.item, s.itemGrey)}>
        <div className={s.falseChecker} />
        <div className={s.bar} />
      </div>
      <div className={s.item}>
        <div className={s.falseChecker} />
        <div className={s.bar} />
      </div>
    </div>
  )
}
