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

export default function ChangelogLayout() {
  const s = useSalon()
  const { edit, layout, isTouched, saving } = useChangelog()
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
              <div className={cnMerge(s.block, isActive && s.blockActive)}>
                {value === CHANGELOG_LAYOUT.CLASSIC ? (
                  <>
                    <div className={cnMerge(s.cover, 'left-16')} />
                    <div className={cnMerge(s.bar, 'h-2.5 top-28 left-16 ml-0.5 opacity-30')} />
                    <div
                      className={cnMerge(s.bar, 'h-1.5 top-32 left-16 ml-0.5 mt-2 w-32 opacity-20')}
                    />
                    <div
                      className={cnMerge(s.bar, 'h-1.5 top-36 left-16 ml-0.5 mt-2 w-28 opacity-10')}
                    />

                    <div className={cnMerge(s.cover, 'left-16 bottom-16')} />
                    <div
                      className={cnMerge(s.bar, 'h-2.5 w-14 bottom-10 left-16 ml-0.5 opacity-30')}
                    />
                    <div
                      className={cnMerge(
                        s.bar,
                        'h-1.5 bottom-6 left-16 ml-0.5 mt-2 w-28 opacity-15',
                      )}
                    />
                  </>
                ) : (
                  <>
                    <div
                      className={cnMerge(s.bar, 'h-1.5 w-7 top-5 mt-0.5 left-10 ml-0.5 opacity-20')}
                    />
                    <div className={cnMerge(s.bar, 'h-2.5 top-5 left-24 ml-0.5 opacity-30')} />
                    <div
                      className={cnMerge(s.bar, 'h-1.5 top-10 left-24 ml-0.5 mt-2 w-28 opacity-30')}
                    />
                    <div
                      className={cnMerge(s.bar, 'h-1.5 top-14 left-24 ml-0.5 mt-2 w-24 opacity-20')}
                    />

                    <div className={cnMerge(s.thumbnil, 'top-20 left-24')} />
                    <div className={cnMerge(s.thumbnil, 'top-20 left-36 ml-2')} />

                    <div
                      className={cnMerge(
                        s.bar,
                        'h-1.5 w-7 top-36 mt-0.5 left-10 ml-0.5 opacity-20',
                      )}
                    />
                    <div
                      className={cnMerge(s.bar, 'h-2.5 w-16 top-36 left-24 ml-0.5 opacity-30')}
                    />
                    <div
                      className={cnMerge(s.bar, 'h-1.5 top-40 left-24 ml-0.5 mt-2 w-24 opacity-30')}
                    />
                    <div
                      className={cnMerge(s.bar, 'h-1.5 top-44 left-24 ml-0.5 mt-2 w-28 opacity-20')}
                    />
                    <div
                      className={cnMerge(s.bar, 'h-1.5 top-48 left-24 ml-0.5 mt-2 w-16 opacity-10')}
                    />

                    <div className={cnMerge(s.thumbnil, 'top-52 mt-2.5 left-24')} />
                    <div className={cnMerge(s.thumbnil, 'top-52 mt-2.5 left-36 ml-2')} />

                    <div
                      className={cnMerge(
                        s.bar,
                        'h-1.5 w-8 bottom-6 mt-0.5 left-10 ml-0.5 opacity-20',
                      )}
                    />
                    <div
                      className={cnMerge(s.bar, 'h-2.5 w-16 bottom-6 left-24 ml-0.5 opacity-30')}
                    />
                  </>
                )}
              </div>

              <CheckLabel title={t(titleKey)} active={isActive} top={4} />
            </button>
          )
        })}
      </div>

      <SavingBar isTouched={isTouched} field={FIELD.CHANGELOG_LAYOUT} loading={saving} top={12} />
    </div>
  )
}
