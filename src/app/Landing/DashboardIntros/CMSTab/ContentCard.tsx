import { mockUsers } from '~/mock'

import { COLOR_NAME } from '~/const/colors'
import CurveLineSVG from '~/icons/CurveLine'
import PostSVG from '~/icons/Post'
import WebhookSVG from '~/icons/Webhook'
import AuthSVG from '~/icons/Acount'

import Facepile from '~/widgets/Facepile/LandingPage'

import Checker from '~/widgets/Checker'
import ArticleCatState from '~/widgets/ArticleCatState'
import CommentsCount from '~/widgets/CommentsCount'

import useSalon, { cn } from '../../salon/dashboard_intros/cms_tab/content_card'

export default () => {
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
        <Checker checked size="small" color={COLOR_NAME.BLUE} />
        <div className={s.title}>支持离线同步</div>
        <ArticleCatState left={2} right={3} />
        <CommentsCount count={8} size="medium" left={3} right={4} />

        <Facepile users={users} className="scale-90 -mt-0.5" />
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
