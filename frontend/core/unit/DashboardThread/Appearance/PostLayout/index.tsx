import { POST_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import usePost from '../../logic/usePost'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import ClassicPreview from './ClassicPreview'
import CoverPreview from './CoverPreview'
import MasonryPreview from './MasonryPreview'
import MinimalPreview from './MinimalPreview'
import useSalon from './salon'
import ThreeColumnPreview from './ThreeColumnPreview'

export { default as ClassicPreview } from './ClassicPreview'
export { default as CoverPreview } from './CoverPreview'
export { default as MasonryPreview } from './MasonryPreview'
export { default as MinimalPreview } from './MinimalPreview'
export { default as ThreeColumnPreview } from './ThreeColumnPreview'

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
        touched={isTouched}
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
