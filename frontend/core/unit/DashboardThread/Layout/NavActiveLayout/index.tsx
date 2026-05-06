import { NAV_ACTIVE_LAYOUT } from '~/const/layout'
import useNavActiveLayoutSalon from '~/hooks/useNavActiveLayoutSalon'
import useTrans from '~/hooks/useTrans'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import useNavActiveLayout from '../../logic/useNavActiveLayout'
import useSalon, { cnMerge } from '../../salon/layout/nav_active_layout'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'

const LAYOUT_OPTIONS = [
  {
    value: NAV_ACTIVE_LAYOUT.TEXT,
    titleKey: 'dsb.layout.nav_active.option.text',
  },
  {
    value: NAV_ACTIVE_LAYOUT.GRAY_BG,
    titleKey: 'dsb.layout.nav_active.option.gray_bg',
  },
  {
    value: NAV_ACTIVE_LAYOUT.SOFT_BG,
    titleKey: 'dsb.layout.nav_active.option.soft_bg',
  },
] as const

const PREVIEW_KEYS = [
  'dsb.layout.nav_active.preview.post',
  'dsb.layout.nav_active.preview.changelog',
  'dsb.layout.nav_active.preview.doc',
] as const

function Preview({
  layout,
}: {
  layout: (typeof NAV_ACTIVE_LAYOUT)[keyof typeof NAV_ACTIVE_LAYOUT]
}) {
  const s = useSalon()
  const { t } = useTrans()
  const activeStyle = useNavActiveLayoutSalon({ layout })

  return (
    <div className={s.preview}>
      {PREVIEW_KEYS.map((titleKey, index) => {
        const isActive = index === 1

        return (
          <div
            key={titleKey}
            className={cnMerge(
              s.previewItem,
              !isActive && s.previewItemInactive,
              isActive && activeStyle.item,
            )}
          >
            {t(titleKey)}
          </div>
        )
      })}
    </div>
  )
}

export default function NavActiveLayout() {
  const s = useSalon()
  const { t } = useTrans()
  const { edit, layout, isTouched, isSupported } = useNavActiveLayout()

  if (!isSupported) return null

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.layout.nav_active.title')}
        desc={t('dsb.layout.nav_active.desc')}
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
