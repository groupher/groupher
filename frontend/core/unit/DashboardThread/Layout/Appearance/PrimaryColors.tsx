import useTrans from '~/hooks/useTrans'
import useTwBelt from '~/hooks/useTwBelt'
import ColorSelector from '~/widgets/ColorSelector'

import { FIELD } from '../../constant'
import useSalon, { cn, cnMerge } from './salon/primary_colors'
import type { TThemePresetOverrides } from './spec'

type TProps = {
  selectedOverrides: TThemePresetOverrides
  primaryCustomColor: string
  isLightTheme: boolean
  onThemePresetCommit: (patch: Partial<TThemePresetOverrides>) => void
}

export default function PrimaryColors({
  selectedOverrides,
  primaryCustomColor,
  isLightTheme,
  onThemePresetCommit,
}: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const { subPrimary } = useTwBelt()

  return (
    <div className={s.wrapper}>
      <div className={s.left}>
        <div className={s.head}>
          <div className={s.ballWrapper}>
            <ColorSelector
              activeColor={selectedOverrides.primaryColor}
              customColor={primaryCustomColor}
              allowCustomColor
              onChange={(primaryColor) =>
                onThemePresetCommit({ [FIELD.PRIMARY_COLOR]: primaryColor })
              }
              onCustomColorChange={(color) => {
                onThemePresetCommit({
                  [isLightTheme ? FIELD.PRIMARY_CUSTOM_COLOR : FIELD.PRIMARY_CUSTOM_COLOR_DARK]:
                    color,
                })
              }}
            >
              <div className={s.colorBall} />
            </ColorSelector>
          </div>
          <div className={s.title}>{t('dsb.layout.primary_color.label')}</div>
        </div>
        <p className={s.desc}>{t('dsb.layout.primary_color.hint')}</p>
      </div>

      <div className={s.right}>
        <div className={cn(s.head, s.subHead)}>
          <div className={cnMerge(s.ballWrapper, s.subBall, subPrimary('borderSoft'))}>
            <ColorSelector
              activeColor={selectedOverrides.subPrimaryColor}
              onChange={(subPrimaryColor) =>
                onThemePresetCommit({ [FIELD.SUB_PRIMARY_COLOR]: subPrimaryColor })
              }
            >
              <div className={cnMerge(s.colorBall, s.subColorBall, subPrimary('bg'))} />
            </ColorSelector>
          </div>
          <div className={s.title}>{t('dsb.layout.sub_primary_color.title')}</div>
        </div>
        <p className={s.desc}>{t('dsb.layout.sub_primary_color.desc')}</p>
      </div>
    </div>
  )
}
