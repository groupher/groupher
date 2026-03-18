import { INLINE_TAG_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import CheckLabel from '~/widgets/CheckLabel'
import { FIELD } from '../../constant'
import useTags from '../../logic/useTags'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cnMerge } from '../../salon/layout/inline_tag_layout'
import { TAGS_DEMO_LIST } from './constant'
import TagItem from './TagItem'

export default function InlineTagLayout() {
  const s = useSalon()
  const { t } = useTrans()

  const { edit, inlineTagLayout, inlineTagLayoutTouched: isTouched, saving } = useTags()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.layout.inline_tag.title')}
        desc={t('dsb.layout.inline_tag.desc')}
      />
      <div className={s.select}>
        <button
          className={s.layout}
          onClick={() => edit(INLINE_TAG_LAYOUT.MORANDI, 'inlineTagLayout')}
        >
          <div
            className={cnMerge(
              s.block,
              inlineTagLayout === INLINE_TAG_LAYOUT.MORANDI && s.blockActive,
            )}
          >
            {TAGS_DEMO_LIST.map((item) => (
              <TagItem key={item.id} tag={item} layout={INLINE_TAG_LAYOUT.MORANDI} />
            ))}
          </div>

          <CheckLabel
            title={t('dsb.layout.inline_tag.option.morandi')}
            active={inlineTagLayout === INLINE_TAG_LAYOUT.MORANDI}
            top={3}
          />
        </button>

        <button
          className={s.layout}
          onClick={() => edit(INLINE_TAG_LAYOUT.SOFT, 'inlineTagLayout')}
        >
          <div
            className={cnMerge(
              s.block,
              inlineTagLayout === INLINE_TAG_LAYOUT.SOFT && s.blockActive,
            )}
          >
            {TAGS_DEMO_LIST.map((item) => (
              <TagItem key={item.id} tag={item} layout={INLINE_TAG_LAYOUT.SOFT} />
            ))}
          </div>

          <CheckLabel
            title={t('dsb.layout.inline_tag.option.soft')}
            active={inlineTagLayout === INLINE_TAG_LAYOUT.SOFT}
            top={3}
          />
        </button>

        <button
          className={s.layout}
          onClick={() => edit(INLINE_TAG_LAYOUT.SOLID, 'inlineTagLayout')}
        >
          <div
            className={cnMerge(
              s.block,
              inlineTagLayout === INLINE_TAG_LAYOUT.SOLID && s.blockActive,
            )}
          >
            {TAGS_DEMO_LIST.map((item) => (
              <TagItem key={item.id} tag={item} layout={INLINE_TAG_LAYOUT.SOLID} />
            ))}
          </div>

          <CheckLabel
            title={t('dsb.layout.inline_tag.option.solid')}
            active={inlineTagLayout === INLINE_TAG_LAYOUT.SOLID}
            top={3}
          />
        </button>

        <button
          className={s.layout}
          onClick={() => edit(INLINE_TAG_LAYOUT.BORDER, 'inlineTagLayout')}
        >
          <div
            className={cnMerge(
              s.block,
              inlineTagLayout === INLINE_TAG_LAYOUT.BORDER && s.blockActive,
            )}
          >
            {TAGS_DEMO_LIST.map((item) => (
              <TagItem key={item.id} tag={item} layout={INLINE_TAG_LAYOUT.BORDER} />
            ))}
          </div>

          <CheckLabel
            title={t('dsb.layout.inline_tag.option.border')}
            active={inlineTagLayout === INLINE_TAG_LAYOUT.BORDER}
            top={3}
          />
        </button>

        <button
          className={s.layout}
          onClick={() => edit(INLINE_TAG_LAYOUT.SIMPLE, 'inlineTagLayout')}
        >
          <div
            className={cnMerge(
              s.block,
              inlineTagLayout === INLINE_TAG_LAYOUT.SIMPLE && s.blockActive,
            )}
          >
            {TAGS_DEMO_LIST.map((item) => (
              <TagItem key={item.id} tag={item} layout={INLINE_TAG_LAYOUT.SIMPLE} />
            ))}
          </div>

          <CheckLabel
            title={t('dsb.layout.inline_tag.option.simple')}
            active={inlineTagLayout === INLINE_TAG_LAYOUT.SIMPLE}
            top={3}
          />
        </button>
      </div>
      <SavingBar isTouched={isTouched} field={FIELD.INLINE_TAG_LAYOUT} loading={saving} top={10} />
    </div>
  )
}
