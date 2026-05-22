import { CHANGELOG_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import useChangelog from '../../logic/useChangelog'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import ClassicPreview from './ClassicPreview'
import MinimalPreview from './MinimalPreview'
import useSalon from './salon'

const CHANGELOG_LAYOUT_OPTIONS = [
  {
    value: CHANGELOG_LAYOUT.CLASSIC,
    titleKey: 'dsb.appearance.changelog.option.classic',
  },
  {
    value: CHANGELOG_LAYOUT.SIMPLE,
    titleKey: 'dsb.appearance.changelog.option.simple',
  },
] as const

export default function ChangelogLayout() {
  const s = useSalon()
  const { edit, layout, isTouched } = useChangelog()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.appearance.changelog.title')}
        desc={t('dsb.appearance.changelog.desc')}
        detailText={t('dsb.appearance.view_example')}
      />
      <div className={s.select}>
        {CHANGELOG_LAYOUT_OPTIONS.map(({ value, titleKey }) => {
          const isActive = layout === value

          return (
            <button
              key={value}
              type='button'
              className={s.layout}
              aria-pressed={isActive}
              onClick={() => edit(value, FIELD.CHANGELOG_LAYOUT)}
            >
              {value === CHANGELOG_LAYOUT.CLASSIC ? (
                <ClassicPreview isActive={isActive} />
              ) : (
                <MinimalPreview isActive={isActive} />
              )}

              <CheckLabel title={t(titleKey)} active={isActive} top={4} />
            </button>
          )
        })}
      </div>

      <SavingBar isTouched={isTouched} field={FIELD.CHANGELOG_LAYOUT} top={12} />
    </div>
  )
}
