import { type FC, memo } from 'react'

import { POST_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import type { TPostLayout } from '~/spec'
import {
  ClassicPreview,
  CoverPreview,
  MasonryPreview,
  MinimalPreview,
  ThreeColumnPreview,
} from '~/unit/DashboardThread/Appearance/PostLayout'
import CheckLabel from '~/widgets/CheckLabel'

import useSalon from './salon/post_layout'

type TProps = {
  layout: string
  onChange: (layout: TPostLayout) => void
}

const PostListLayout: FC<TProps> = ({ layout, onChange }) => {
  const s = useSalon()
  const { t } = useTrans()
  const classicTitle = t('dsb.appearance.post.option.classic')
  const phTitle = t('dsb.appearance.post.option.ph')
  const masonryTitle = t('dsb.appearance.post.option.masonry')
  const minimalTitle = t('dsb.appearance.post.option.minimal')
  const coverTitle = t('dsb.appearance.post.option.cover')

  return (
    <div className={s.wrapper}>
      <button
        type='button'
        className={s.layout}
        aria-label={classicTitle}
        aria-pressed={layout === POST_LAYOUT.QUORA}
        onClick={() => onChange(POST_LAYOUT.QUORA)}
      >
        <ClassicPreview isActive={layout === POST_LAYOUT.QUORA} compact />
        <CheckLabel title={classicTitle} active={layout === POST_LAYOUT.QUORA} top={4} />
      </button>
      <button
        type='button'
        className={s.layout}
        aria-label={phTitle}
        aria-pressed={layout === POST_LAYOUT.PH}
        onClick={() => onChange(POST_LAYOUT.PH)}
      >
        <ThreeColumnPreview isActive={layout === POST_LAYOUT.PH} compact />
        <CheckLabel title={phTitle} active={layout === POST_LAYOUT.PH} top={4} />
      </button>

      <button
        type='button'
        className={s.layout}
        aria-label={masonryTitle}
        aria-pressed={layout === POST_LAYOUT.MASONRY}
        onClick={() => onChange(POST_LAYOUT.MASONRY)}
      >
        <MasonryPreview isActive={layout === POST_LAYOUT.MASONRY} compact />
        <CheckLabel title={masonryTitle} active={layout === POST_LAYOUT.MASONRY} top={4} />
      </button>

      <button
        type='button'
        className={s.layout}
        aria-label={minimalTitle}
        aria-pressed={layout === POST_LAYOUT.MINIMAL}
        onClick={() => onChange(POST_LAYOUT.MINIMAL)}
      >
        <MinimalPreview isActive={layout === POST_LAYOUT.MINIMAL} compact />
        <CheckLabel title={minimalTitle} active={layout === POST_LAYOUT.MINIMAL} top={4} />
      </button>

      <button
        type='button'
        className={s.layout}
        aria-label={coverTitle}
        aria-pressed={layout === POST_LAYOUT.COVER}
        onClick={() => onChange(POST_LAYOUT.COVER)}
      >
        <CoverPreview isActive={layout === POST_LAYOUT.COVER} compact />
        <CheckLabel title={coverTitle} active={layout === POST_LAYOUT.COVER} top={4} />
      </button>
    </div>
  )
}

export default memo(PostListLayout)
