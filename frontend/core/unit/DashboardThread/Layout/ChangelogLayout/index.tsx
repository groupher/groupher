import { CHANGELOG_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import useChangelog from '../../logic/useChangelog'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cnMerge } from '../../salon/layout/changelog_layout'

const CHANGELOG_LAYOUT_OPTIONS = [
  {
    value: CHANGELOG_LAYOUT.CLASSIC,
    titleKey: 'dsb.layout.changelog.option.classic',
  },
  {
    value: CHANGELOG_LAYOUT.SIMPLE,
    titleKey: 'dsb.layout.changelog.option.simple',
  },
] as const

function ClassicPreview({ isActive }: { isActive: boolean }) {
  const s = useSalon()

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
      <div className={s.frame}>
        <div className={s.classicList}>
          <div className={s.classicEntry}>
            <div className={s.classicCover} />
            <div className={s.classicText}>
              <div className={s.classicTitle} />
              <div className={s.classicBodyWide} />
              <div className={s.classicBodyNarrow} />
            </div>
          </div>

          <div className={s.classicEntry}>
            <div className={s.classicCover} />
            <div className={s.classicText}>
              <div className={s.classicTitle} />
              <div className={s.classicBodyNarrow} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MinimalPreview({ isActive }: { isActive: boolean }) {
  const s = useSalon()

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
      <div className={s.frame}>
        <div className={s.minimalList}>
          <div className={s.minimalListInner}>
            <div className={s.minimalEntry}>
              <div className={s.minimalHeader}>
                <div className={s.minimalMeta} />
                <div className={s.minimalMain}>
                  <div className={s.minimalText}>
                    <div className={s.minimalTitle} />
                    <div className={s.minimalBodyWide} />
                    <div className={s.minimalBodyNarrow} />
                  </div>
                  <div className={s.minimalThumbRow}>
                    <div className={s.minimalThumb} />
                    <div className={s.minimalThumb} />
                  </div>
                </div>
              </div>
            </div>

            <div className={s.minimalEntry}>
              <div className={s.minimalHeader}>
                <div className={s.minimalMeta} />
                <div className={s.minimalMain}>
                  <div className={s.minimalText}>
                    <div className={s.minimalTitle} />
                    <div className={s.minimalBodyNarrow} />
                    <div className={s.minimalBodyWide} />
                    <div className={s.minimalBodyTiny} />
                  </div>
                  <div className={s.minimalThumbRow}>
                    <div className={s.minimalThumb} />
                    <div className={s.minimalThumb} />
                  </div>
                </div>
              </div>
            </div>

            <div className={s.minimalEntry}>
              <div className={s.minimalHeader}>
                <div className={s.minimalMeta} />
                <div className={s.minimalMain}>
                  <div className={s.minimalTitle} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ChangelogLayout() {
  const s = useSalon()
  const { edit, layout, isTouched } = useChangelog()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.layout.changelog.title')}
        desc={t('dsb.layout.changelog.desc')}
        detailText={t('dsb.layout.view_example')}
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
