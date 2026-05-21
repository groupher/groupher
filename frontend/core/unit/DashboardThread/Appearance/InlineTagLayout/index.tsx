import { INLINE_TAG_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import useTags from '../../logic/useTags'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import { TAGS_DEMO_LIST } from './constant'
import useSalon, { cnMerge } from './salon'
import TagItem from './TagItem'

const LAYOUT_OPTIONS = [
  {
    value: INLINE_TAG_LAYOUT.MORANDI,
    titleKey: 'dsb.appearance.inline_tag.option.morandi',
  },
  {
    value: INLINE_TAG_LAYOUT.SOFT,
    titleKey: 'dsb.appearance.inline_tag.option.soft',
  },
  {
    value: INLINE_TAG_LAYOUT.SOLID,
    titleKey: 'dsb.appearance.inline_tag.option.solid',
  },
  {
    value: INLINE_TAG_LAYOUT.BORDER,
    titleKey: 'dsb.appearance.inline_tag.option.border',
  },
  {
    value: INLINE_TAG_LAYOUT.SIMPLE,
    titleKey: 'dsb.appearance.inline_tag.option.simple',
  },
] as const

export default function InlineTagLayout() {
  const s = useSalon()
  const { t } = useTrans()

  const { edit, inlineTagLayout, inlineTagLayoutTouched: isTouched } = useTags()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.appearance.inline_tag.title')}
        desc={t('dsb.appearance.inline_tag.desc')}
      />
      <div className={s.select}>
        {LAYOUT_OPTIONS.map(({ value, titleKey }) => {
          const isActive = inlineTagLayout === value

          return (
            <button
              key={value}
              type='button'
              className={s.layout}
              aria-pressed={isActive}
              onClick={() => edit(value, FIELD.INLINE_TAG_LAYOUT)}
            >
              <div className={cnMerge(s.block, isActive && s.blockActive)}>
                {TAGS_DEMO_LIST.map((item) => (
                  <TagItem key={item.id} tag={item} layout={value} />
                ))}
              </div>

              <CheckLabel title={t(titleKey)} active={isActive} top={3} />
            </button>
          )
        })}
      </div>
      <SavingBar isTouched={isTouched} field={FIELD.INLINE_TAG_LAYOUT} top={10} />
    </div>
  )
}
