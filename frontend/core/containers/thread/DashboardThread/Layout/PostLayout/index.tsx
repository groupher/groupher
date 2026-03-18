import { POST_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import CommentSVG from '~/icons/Comment'
import UpvoteSVG from '~/icons/Upvote'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import usePost from '../../logic/usePost'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cnMerge } from '../../salon/layout/post_layout'

export default function PostLayout() {
  const s = useSalon()
  const { layout, isTouched, saving, edit } = usePost()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.layout.post.title')}
        desc={t('dsb.layout.post.desc')}
        detailText={t('dsb.layout.view_example')}
      />
      <div className={s.select}>
        <button
          type='button'
          className={s.layout}
          aria-pressed={layout === POST_LAYOUT.QUORA}
          onClick={() => edit(POST_LAYOUT.QUORA, FIELD.POST_LAYOUT)}
        >
          <div className={cnMerge(s.block, layout === POST_LAYOUT.QUORA && s.blockActive)}>
            <div className={cnMerge(s.bar, 'left-4 top-5 h-1 opacity-30')} />

            <div className={cnMerge(s.bar, 'left-4 top-8 w-28 h-2.5 opacity-50')} />
            <div className={cnMerge(s.bar, 'left-4 top-12 w-48 mt-0.5 opacity-30')} />

            <CommentSVG className={cnMerge(s.commentIcon, 'right-5 top-5')} />

            <UpvoteSVG className={cnMerge(s.upvoteIcon, 'left-4 bottom-3')} />
            <div className={cnMerge(s.bar, 'left-10 bottom-4 w-10 h-2 opacity-40')} />
            <div className={cnMerge(s.bar, 'left-24 bottom-4 w-10 h-1 mb-0.5 opacity-20')} />
          </div>
          <CheckLabel
            title={t('dsb.layout.post.option.classic')}
            active={layout === POST_LAYOUT.QUORA}
            top={4}
          />
        </button>
        <button
          type='button'
          className={s.layout}
          aria-pressed={layout === POST_LAYOUT.PH}
          onClick={() => edit(POST_LAYOUT.PH, FIELD.POST_LAYOUT)}
        >
          <div className={cnMerge(s.block, layout === POST_LAYOUT.PH && s.blockActive)}>
            <div className={s.userAvatar} />

            <div className={cnMerge(s.bar, 'left-14 top-6 w-24 h-2.5 opacity-40')} />
            <div className={cnMerge(s.bar, 'left-14 top-11 w-36 h-1.5 opacity-20')} />
            <div className={cnMerge(s.bar, 'left-14 top-14 w-14 h-1.5 opacity-15')} />

            <div className={cnMerge(s.upvoteBtn, 'top-4 right-5 scale-90')}>
              <UpvoteSVG className={cnMerge(s.upvoteIcon, 'relative')} />
              <div>N</div>
            </div>
          </div>
          <CheckLabel
            title={t('dsb.layout.post.option.ph')}
            active={layout === POST_LAYOUT.PH}
            top={15}
          />
        </button>

        <button
          type='button'
          className={s.layout}
          aria-pressed={layout === POST_LAYOUT.MASONRY}
          onClick={() => edit(POST_LAYOUT.MASONRY, FIELD.POST_LAYOUT)}
        >
          <div className={cnMerge(s.block, layout === POST_LAYOUT.MASONRY && s.blockActive)}>
            <div className={cnMerge(s.bar, 'left-6 top-0 w-28 h-2 opacity-15')} />
            <div className={cnMerge(s.bar, 'left-6 top-4 w-28 h-12 opacity-50')} />
            <div className={cnMerge(s.bar, 'left-6 bottom-0 w-28 h-6 opacity-20')} />

            <div className={cnMerge(s.bar, 'right-6 top-0 w-28 h-4 opacity-20')} />
            <div className={cnMerge(s.bar, 'right-6 top-6 w-28 h-14 opacity-40')} />
            <div className={cnMerge(s.bar, 'right-6 bottom-0 w-28 h-2 opacity-15')} />
          </div>
          <CheckLabel
            title={t('dsb.layout.post.option.masonry')}
            active={layout === POST_LAYOUT.MASONRY}
            top={4}
          />
        </button>

        <button
          type='button'
          className={s.layout}
          aria-pressed={layout === POST_LAYOUT.MINIMAL}
          onClick={() => edit(POST_LAYOUT.MINIMAL, FIELD.POST_LAYOUT)}
        >
          <div className={cnMerge(s.block, layout === POST_LAYOUT.MINIMAL && s.blockActive)}>
            <div className={cnMerge(s.upvoteBtn, 'top-5 left-5')}>
              <UpvoteSVG className={cnMerge(s.upvoteIcon, 'relative')} />
              <div>N</div>
            </div>

            <div className={cnMerge(s.bar, 'left-20 top-6 w-28 h-2.5 opacity-40')} />
            <div className={cnMerge(s.bar, 'left-20 top-11 w-36 h-1.5 opacity-20')} />
            <div className={cnMerge(s.bar, 'left-20 top-14 w-10 h-1.5 opacity-15')} />

            <CommentSVG className={cnMerge(s.upvoteIcon, 'right-6 top-6 ml-5 size-3')} />
          </div>
          <CheckLabel
            title={t('dsb.layout.post.option.minimal')}
            active={layout === POST_LAYOUT.MINIMAL}
            top={15}
          />
        </button>

        <button
          type='button'
          className={s.layout}
          aria-pressed={layout === POST_LAYOUT.COVER}
          onClick={() => edit(POST_LAYOUT.COVER, FIELD.POST_LAYOUT)}
        >
          <div className={cnMerge(s.block, layout === POST_LAYOUT.COVER && s.blockActive)}>
            <div className={cnMerge(s.bar, 'left-5 top-4 w-24 h-16 opacity-30')} />
            <div className={cnMerge(s.bar, 'right-28 top-6 w-12 h-1.5 opacity-20')} />
            <div className={cnMerge(s.bar, 'right-12 top-10 w-28 h-2 opacity-40')} />

            <UpvoteSVG className={cnMerge(s.upvoteIcon, 'right-36 bottom-4 ml-5')} />
            <div className={cnMerge(s.bar, 'left-36 bottom-5 w-4 h-1.5 opacity-30')} />

            <CommentSVG className={cnMerge(s.upvoteIcon, 'right-24 bottom-4 ml-5 size-3.5')} />
            <div className={cnMerge(s.bar, 'right-16 bottom-5 ml-2 w-6 h-1.5 opacity-20')} />
          </div>
          <CheckLabel
            title={t('dsb.layout.post.option.cover')}
            active={layout === POST_LAYOUT.COVER}
            top={4}
          />
        </button>
      </div>

      <SavingBar isTouched={isTouched} field={FIELD.POST_LAYOUT} loading={saving} top={20} />
    </div>
  )
}
