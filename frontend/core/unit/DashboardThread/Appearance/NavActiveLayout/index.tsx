import { NAV_ACTIVE_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import useNavActiveLayout from '../../logic/useNavActiveLayout'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import Preview from './Preview'
import useSalon, { cnMerge } from './salon'

const LAYOUT_OPTIONS = [
  {
    value: NAV_ACTIVE_LAYOUT.TEXT,
    titleKey: 'dsb.appearance.nav_active.option.text',
  },
  {
    value: NAV_ACTIVE_LAYOUT.GRAY_BG,
    titleKey: 'dsb.appearance.nav_active.option.gray_bg',
  },
  {
    value: NAV_ACTIVE_LAYOUT.SOFT_BG,
    titleKey: 'dsb.appearance.nav_active.option.soft_bg',
  },
] as const

export default function NavActiveLayout() {
  const s = useSalon()
  const { t } = useTrans()
  const { edit, layout, isTouched, isSupported } = useNavActiveLayout()

  if (!isSupported) return null

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.appearance.nav_active.title')}
        desc={t('dsb.appearance.nav_active.desc')}
      />
      <div className={s.select}>
        {LAYOUT_OPTIONS.map(({ value, titleKey }) => {
          const isActive = layout === value

          return (
            <button
              key={value}
              type='button'
              className={s.layout}
              aria-pressed={isActive}
              onClick={() => edit(value, FIELD.NAV_ACTIVE_LAYOUT)}
            >
              <div className={cnMerge(s.block, isActive && s.blockActive)}>
                <Preview layout={value} />
              </div>

              <CheckLabel title={t(titleKey)} active={isActive} top={3} />
            </button>
          )
        })}
      </div>
      <SavingBar isTouched={isTouched} field={FIELD.NAV_ACTIVE_LAYOUT} top={10} />
    </div>
  )
}
