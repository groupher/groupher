import { POST_LAYOUT, DASHBOARD_DESC_LAYOUT } from '~/const/layout'
import { callDashboardDesc } from '~/signal'

import UpvoteSVG from '~/icons/Upvote'
import CommentSVG from '~/icons/Comment'

import ArrowButton from '~/widgets/Buttons/ArrowButton'
import CheckLabel from '~/widgets/CheckLabel'

import { SETTING_FIELD } from '../constant'
import SectionLabel from '../SectionLabel'
import SavingBar from '../SavingBar'

import usePost from '../logic/usePost'
import useSalon, { cn } from '../salon/layout/post_layout'

export default () => {
  const s = useSalon()
  const { layout, getIsTouched, saving, edit } = usePost()

  const isTouched = getIsTouched()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title="讨论区布局"
        desc={
          <>
            「讨论区」列表的默认布局，切换布局不影响已发布内容。
            <div className={s.inline}>
              <ArrowButton onClick={() => callDashboardDesc(DASHBOARD_DESC_LAYOUT.POST_LIST)}>
                查看示例
              </ArrowButton>
            </div>
          </>
        }
      />
      <div className={s.select}>
        <div className={s.layout} onClick={() => edit(POST_LAYOUT.QUORA, 'postLayout')}>
          <div className={cn(s.block, layout === POST_LAYOUT.QUORA && s.blockActive)}>
            <div className={cn(s.bar, 'left-4 top-5 h-1 opacity-30')} />

            <div className={cn(s.bar, 'left-4 top-8 w-28 h-2.5 opacity-50')} />
            <div className={cn(s.bar, 'left-4 top-12 w-48 mt-0.5 opacity-30')} />

            <CommentSVG className={cn(s.commentIcon, 'right-5 top-5')} />

            <UpvoteSVG className={cn(s.upvoteIcon, 'left-4 bottom-3')} />
            <div className={cn(s.bar, 'left-10 bottom-4 w-10 h-2 opacity-40')} />
            <div className={cn(s.bar, 'left-24 bottom-4 w-10 h-1 mb-0.5 opacity-20')} />
          </div>
          <CheckLabel title="经典（默认）" active={layout === POST_LAYOUT.QUORA} top={4} />
        </div>
        <div className={s.layout} onClick={() => edit(POST_LAYOUT.PH, 'postLayout')}>
          <div className={cn(s.block, layout === POST_LAYOUT.PH && s.blockActive)}>
            <div className={s.userAvatar} />
            <div className={cn(s.upvoteBtn, 'top-4 right-5 scale-90')}>
              <UpvoteSVG className={cn(s.upvoteIcon, 'relative')} />
              <div>N</div>
            </div>

            <div className={cn(s.bar, 'left-14 top-6 w-24 h-2.5 opacity-40')} />
            <div className={cn(s.bar, 'left-14 top-11 w-36 h-1.5 opacity-20')} />
            <div className={cn(s.bar, 'left-14 top-14 w-14 h-1.5 opacity-15')} />
          </div>
          <CheckLabel title="三段式" active={layout === POST_LAYOUT.PH} top={15} />
        </div>

        <div className={s.layout} onClick={() => edit(POST_LAYOUT.MASONRY, 'postLayout')}>
          <div className={cn(s.block, layout === POST_LAYOUT.MASONRY && s.blockActive)}>
            <div className={cn(s.bar, 'left-6 top-0 w-28 h-2 opacity-15')} />
            <div className={cn(s.bar, 'left-6 top-4 w-28 h-12 opacity-50')} />
            <div className={cn(s.bar, 'left-6 bottom-0 w-28 h-6 opacity-20')} />

            <div className={cn(s.bar, 'right-6 top-0 w-28 h-4 opacity-20')} />
            <div className={cn(s.bar, 'right-6 top-6 w-28 h-14 opacity-40')} />
            <div className={cn(s.bar, 'right-6 bottom-0 w-28 h-2 opacity-15')} />
          </div>
          <CheckLabel title="瀑布流卡片" active={layout === POST_LAYOUT.MASONRY} top={4} />
        </div>

        <div className={s.layout} onClick={() => edit(POST_LAYOUT.MINIMAL, 'postLayout')}>
          <div className={cn(s.block, layout === POST_LAYOUT.MINIMAL && s.blockActive)}>
            <div className={cn(s.upvoteBtn, 'top-5 left-5')}>
              <UpvoteSVG className={cn(s.upvoteIcon, 'relative')} />
              <div>N</div>
            </div>

            <div className={cn(s.bar, 'left-20 top-6 w-28 h-2.5 opacity-40')} />
            <div className={cn(s.bar, 'left-20 top-11 w-36 h-1.5 opacity-20')} />
            <div className={cn(s.bar, 'left-20 top-14 w-10 h-1.5 opacity-15')} />

            <CommentSVG className={cn(s.upvoteIcon, 'right-6 top-6 ml-5 size-3')} />
          </div>
          <CheckLabel title="极简" active={layout === POST_LAYOUT.MINIMAL} top={15} />
        </div>

        <div className={s.layout} onClick={() => edit(POST_LAYOUT.COVER, 'postLayout')}>
          <div className={cn(s.block, layout === POST_LAYOUT.COVER && s.blockActive)}>
            <div className={cn(s.bar, 'left-5 top-4 w-24 h-16 opacity-30')} />
            <div className={cn(s.bar, 'right-28 top-6 w-12 h-1.5 opacity-20')} />
            <div className={cn(s.bar, 'right-12 top-10 w-28 h-2 opacity-40')} />

            <UpvoteSVG className={cn(s.upvoteIcon, 'right-36 bottom-4 ml-5')} />
            <div className={cn(s.bar, 'left-36 bottom-5 w-4 h-1.5 opacity-30')} />

            <CommentSVG className={cn(s.upvoteIcon, 'right-24 bottom-4 ml-5 size-3.5')} />
            <div className={cn(s.bar, 'right-16 bottom-5 ml-2 w-6 h-1.5 opacity-20')} />
          </div>
          <CheckLabel title="封面图" active={layout === POST_LAYOUT.COVER} top={4} />
        </div>
      </div>

      <SavingBar
        width="w-11/12"
        isTouched={isTouched}
        field={SETTING_FIELD.POST_LAYOUT}
        loading={saving}
        top={20}
      />
    </div>
  )
}
