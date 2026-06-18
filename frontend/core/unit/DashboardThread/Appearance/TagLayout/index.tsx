import { TAG_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import HashTagSVG from '~/icons/HashTag'
import TagSVG from '~/icons/Tag'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import useTags from '../../logic/useTags'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cnMerge } from './salon'

const TAG_LAYOUT_OPTIONS = [
  {
    value: TAG_LAYOUT.HASH,
    titleKey: 'dsb.appearance.tag.option.hash',
  },
  {
    value: TAG_LAYOUT.DOT,
    titleKey: 'dsb.appearance.tag.option.dot',
  },
  {
    value: TAG_LAYOUT.ICON,
    titleKey: 'dsb.appearance.tag.option.icon',
  },
] as const

const PREVIEW_ITEMS = ['first', 'second'] as const

export default function TagLayout() {
  const s = useSalon()
  const { t } = useTrans()

  const { edit, tagLayout, tagLayoutTouched: isTouched } = useTags()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.appearance.tag.title')}
        desc={t('dsb.appearance.tag.desc')}
        touched={isTouched}
      />
      <div className={s.select}>
        {TAG_LAYOUT_OPTIONS.map(({ value, titleKey }) => {
          const isActive = tagLayout === value

          return (
            <button
              key={value}
              type='button'
              className={s.layout}
              aria-pressed={isActive}
              onClick={() => edit(value, FIELD.TAG_LAYOUT)}
            >
              <div className={cnMerge(s.block, isActive && s.blockActive)}>
                <div className={s.previewList}>
                  {PREVIEW_ITEMS.map((item) => (
                    <div key={`${value}-${item}`} className={s.previewItem}>
                      {value === TAG_LAYOUT.HASH && <HashTagSVG className={s.hashIcon} />}
                      {value === TAG_LAYOUT.DOT && <div className={s.circle} />}
                      {value === TAG_LAYOUT.ICON && <TagSVG className={s.hashIcon} />}
                      <div className={s.bar} />
                    </div>
                  ))}
                </div>
              </div>

              <CheckLabel title={t(titleKey)} active={isActive} top={3} />
            </button>
          )
        })}
      </div>
      <SavingBar isTouched={isTouched} field={FIELD.TAG_LAYOUT} top={10} />
    </div>
  )
}
