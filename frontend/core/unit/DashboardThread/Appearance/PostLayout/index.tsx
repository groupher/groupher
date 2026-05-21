import { POST_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import CommentSVG from '~/icons/Comment'
import UpvoteSVG from '~/icons/Upvote'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import usePost from '../../logic/usePost'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cnMerge } from './salon'

type TPreviewProps = {
  isActive: boolean
  compact?: boolean
}

export function ClassicPreview({ isActive, compact }: TPreviewProps) {
  const s = useSalon({ compact })

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
      <div className={s.frame}>
        <div className={s.topRow}>
          <div className={s.header}>
            <div className={cnMerge(s.bar, s.metaBar)} />
            <div className={cnMerge(s.bar, s.titleBar)} />
            <div className={cnMerge(s.bar, s.bodyWide)} />
          </div>
          <CommentSVG className={s.commentIcon} />
        </div>

        <div className={s.footer}>
          <div className={s.footerLeft}>
            <UpvoteSVG className={s.upvoteIcon} />
            <div className={cnMerge(s.bar, s.scoreBar)} />
            <div className={cnMerge(s.bar, s.noteBar)} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ThreeColumnPreview({ isActive, compact }: TPreviewProps) {
  const s = useSalon({ compact })

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
      <div className={cnMerge(s.contentRow, 'items-start')}>
        <div className={cnMerge(s.userAvatar, 'mt-0.5')} />

        <div className={cnMerge(s.textColumn, 'grow pt-1')}>
          <div className={cnMerge(s.bar, s.phTitleBar)} />
          <div className={cnMerge(s.bar, s.phBodyWide)} />
          <div className={cnMerge(s.bar, s.phBodyTiny)} />
        </div>

        <div className={cnMerge(s.upvoteBtn, compact ? '-mt-0.5' : 'scale-90 -mt-1')}>
          <UpvoteSVG className={s.upvoteIcon} />
          <div>N</div>
        </div>
      </div>
    </div>
  )
}

export function MasonryPreview({ isActive, compact }: TPreviewProps) {
  const s = useSalon({ compact })

  return (
    <div className={cnMerge(s.masonryBlock, isActive && s.blockActive)}>
      <div className={s.masonryGrid}>
        <div className={s.masonryCol}>
          <div className={cnMerge(s.bar, s.masonryTopBar)} />
          <div className={cnMerge(s.bar, s.masonryMainCard)} />
          <div className={cnMerge(s.bar, s.masonryBottomCard)} />
        </div>

        <div className={s.masonryCol}>
          <div className={cnMerge(s.bar, s.masonrySideTop)} />
          <div className={cnMerge(s.bar, s.masonrySideMain)} />
          <div className={cnMerge(s.bar, s.masonrySideBottom)} />
        </div>
      </div>
    </div>
  )
}

export function MinimalPreview({ isActive, compact }: TPreviewProps) {
  const s = useSalon({ compact })

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
      <div className={cnMerge(s.contentRow, 'items-start')}>
        <div className={s.upvoteBtn}>
          <UpvoteSVG className={s.upvoteIcon} />
          <div>N</div>
        </div>

        <div className={cnMerge(s.textColumn, 'grow pt-1')}>
          <div className={cnMerge(s.bar, s.minimalTitleBar)} />
          <div className={cnMerge(s.bar, s.minimalBodyWide)} />
          <div className={cnMerge(s.bar, s.minimalBodyTiny)} />
        </div>

        <CommentSVG className={cnMerge(s.upvoteIcon, 'size-3')} />
      </div>
    </div>
  )
}

export function CoverPreview({ isActive, compact }: TPreviewProps) {
  const s = useSalon({ compact })

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
      <div className={s.contentRow}>
        <div className={cnMerge(s.bar, s.coverMedia)} />

        <div className={cnMerge(s.frame, 'grow')}>
          <div className={s.header}>
            <div className={cnMerge(s.bar, s.coverMeta)} />
            <div className={cnMerge(s.bar, s.coverTitle)} />
          </div>

          <div className={s.footer}>
            <div className={s.footerLeft}>
              <UpvoteSVG className={s.upvoteIcon} />
              <div className={cnMerge(s.bar, s.coverScore)} />
            </div>
            <div className={s.footerRight}>
              <CommentSVG className={cnMerge(s.upvoteIcon, 'size-3.5')} />
              <div className={cnMerge(s.bar, s.coverNote)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PostLayout() {
  const s = useSalon()
  const { layout, isTouched, edit } = usePost()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.appearance.post.title')}
        desc={t('dsb.appearance.post.desc')}
        detailText={t('dsb.appearance.view_example')}
      />
      <div className={s.select}>
        <button
          type='button'
          className={s.layout}
          aria-pressed={layout === POST_LAYOUT.QUORA}
          onClick={() => edit(POST_LAYOUT.QUORA, FIELD.POST_LAYOUT)}
        >
          <ClassicPreview isActive={layout === POST_LAYOUT.QUORA} />
          <CheckLabel
            title={t('dsb.appearance.post.option.classic')}
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
          <ThreeColumnPreview isActive={layout === POST_LAYOUT.PH} />
          <CheckLabel
            title={t('dsb.appearance.post.option.ph')}
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
          <MasonryPreview isActive={layout === POST_LAYOUT.MASONRY} />
          <CheckLabel
            title={t('dsb.appearance.post.option.masonry')}
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
          <MinimalPreview isActive={layout === POST_LAYOUT.MINIMAL} />
          <CheckLabel
            title={t('dsb.appearance.post.option.minimal')}
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
          <CoverPreview isActive={layout === POST_LAYOUT.COVER} />
          <CheckLabel
            title={t('dsb.appearance.post.option.cover')}
            active={layout === POST_LAYOUT.COVER}
            top={4}
          />
        </button>
      </div>

      <SavingBar isTouched={isTouched} field={FIELD.POST_LAYOUT} top={20} />
    </div>
  )
}
