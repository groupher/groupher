import { TAG_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import HashTagSVG from '~/icons/HashTag'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import useTags from '../../logic/useTags'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'

import useSalon, { cnMerge } from '../../salon/layout/tag_layout'

const TAG_LAYOUT_OPTIONS = [
  {
    value: TAG_LAYOUT.HASH,
    titleKey: 'dsb.layout.tag.option.hash',
  },
  {
    value: TAG_LAYOUT.DOT,
    titleKey: 'dsb.layout.tag.option.dot',
  },
] as const

export default function TagLayout() {
  const s = useSalon()
  const { t } = useTrans()

  const { edit, tagLayout, tagLayoutTouched: isTouched, saving } = useTags()

  return (
    <div className={s.wrapper}>
      <SectionLabel title={t('dsb.layout.tag.title')} desc={t('dsb.layout.tag.desc')} />
      <div className={s.select}>
        {TAG_LAYOUT_OPTIONS.map(({ value, titleKey }) => {
          const isActive = tagLayout === value

          return (
            <button
              key={value}
              type='button'
              className={s.layout}
              aria-pressed={isActive}
              onClick={() => edit(value, 'tagLayout')}
            >
              <div className={cnMerge(s.block, isActive && s.blockActive)}>
                {value === TAG_LAYOUT.HASH ? (
                  <>
                    <HashTagSVG className={cnMerge(s.hashIcon, 'left-8')} />
                    <div className={cnMerge(s.bar, 'left-16 w-10 h-1.5')} />

                    <HashTagSVG className={cnMerge(s.hashIcon, 'left-36')} />
                    <div className={cnMerge(s.bar, 'right-10 w-10 h-1.5')} />
                  </>
                ) : (
                  <>
                    <div className={cnMerge(s.circle, 'left-10')} />
                    <div className={cnMerge(s.bar, 'left-16 w-10 h-1.5')} />

                    <div className={cnMerge(s.circle, 'right-24')} />
                    <div className={cnMerge(s.bar, 'right-11 w-10 h-1.5')} />
                  </>
                )}
              </div>

              <CheckLabel title={t(titleKey)} active={isActive} top={3} />
            </button>
          )
        })}
      </div>
      <SavingBar isTouched={isTouched} field={FIELD.TAG_LAYOUT} loading={saving} top={10} />
    </div>
  )
}
