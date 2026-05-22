import { NAV_ACTIVE_LAYOUT } from '~/const/layout'
import useNavActiveLayoutSalon from '~/hooks/useNavActiveLayoutSalon'
import useTrans from '~/hooks/useTrans'

import useSalon, { cnMerge } from './salon'

const PREVIEW_KEYS = [
  'dsb.appearance.nav_active.preview.post',
  'dsb.appearance.nav_active.preview.changelog',
  'dsb.appearance.nav_active.preview.doc',
] as const

type TProps = {
  layout: (typeof NAV_ACTIVE_LAYOUT)[keyof typeof NAV_ACTIVE_LAYOUT]
}

export default function Preview({ layout }: TProps) {
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
