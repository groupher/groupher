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
} from '~/unit/DashboardThread/Layout/PostLayout'
import CheckLabel from '~/widgets/CheckLabel'

import useSalon from './salon/post_layout'

type TProps = {
  layout: string
  onChange: (layout: TPostLayout) => void
}

const PostListLayout: FC<TProps> = ({ layout, onChange }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <button type='button' className={s.layout} onClick={() => onChange(POST_LAYOUT.QUORA)}>
        <ClassicPreview isActive={layout === POST_LAYOUT.QUORA} compact />
        <CheckLabel
          title={t('dsb.layout.post.option.classic')}
          active={layout === POST_LAYOUT.QUORA}
          top={4}
        />
      </button>
      <button type='button' className={s.layout} onClick={() => onChange(POST_LAYOUT.PH)}>
        <ThreeColumnPreview isActive={layout === POST_LAYOUT.PH} compact />
        <CheckLabel
          title={t('dsb.layout.post.option.ph')}
          active={layout === POST_LAYOUT.PH}
          top={4}
        />
      </button>

      <button type='button' className={s.layout} onClick={() => onChange(POST_LAYOUT.MASONRY)}>
        <MasonryPreview isActive={layout === POST_LAYOUT.MASONRY} compact />
        <CheckLabel
          title={t('dsb.layout.post.option.masonry')}
          active={layout === POST_LAYOUT.MASONRY}
          top={4}
        />
      </button>

      <button type='button' className={s.layout} onClick={() => onChange(POST_LAYOUT.MINIMAL)}>
        <MinimalPreview isActive={layout === POST_LAYOUT.MINIMAL} compact />
        <CheckLabel
          title={t('dsb.layout.post.option.minimal')}
          active={layout === POST_LAYOUT.MINIMAL}
          top={4}
        />
      </button>

      <button type='button' className={s.layout} onClick={() => onChange(POST_LAYOUT.COVER)}>
        <CoverPreview isActive={layout === POST_LAYOUT.COVER} compact />
        <CheckLabel
          title={t('dsb.layout.post.option.cover')}
          active={layout === POST_LAYOUT.COVER}
          top={4}
        />
      </button>
    </div>
  )
}

export default memo(PostListLayout)
