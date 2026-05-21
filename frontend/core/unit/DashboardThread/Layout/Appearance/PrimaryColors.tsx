import { COLOR, RAINBOW_COLOR_HEX } from '~/const/colors'
import THEME from '~/const/theme'
import useTrans from '~/hooks/useTrans'
import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'
import ColorSelector from '~/widgets/ColorSelector'

import { PRESET_FIELD } from '../../constant'
import useSalon, { cn, cnMerge } from './salon/primary_colors'
import type { TThemePresetOverwrite } from './spec'

type TProps = {
  primaryColor: string
  accentColor: string
  isLightTheme: boolean
  onThemePresetCommit: (patch: Partial<TThemePresetOverwrite>) => void
}

const resolvePresetColor = (color: TColorName, theme: typeof THEME.LIGHT | typeof THEME.DARK) =>
  RAINBOW_COLOR_HEX[theme][color] ?? RAINBOW_COLOR_HEX[theme][COLOR.BLACK]

const findPresetColor = (
  color: string,
  theme: typeof THEME.LIGHT | typeof THEME.DARK,
): TColorName => {
  const match = Object.entries(RAINBOW_COLOR_HEX[theme]).find(([, value]) => value === color)

  return (match?.[0] as TColorName | undefined) ?? COLOR.CUSTOM
}

export default function PrimaryColors({
  primaryColor,
  accentColor,
  isLightTheme,
  onThemePresetCommit,
}: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const { accent } = useTwBelt()
  const theme = isLightTheme ? THEME.LIGHT : THEME.DARK
  const primaryField = isLightTheme ? PRESET_FIELD.PRIMARY_COLOR : PRESET_FIELD.PRIMARY_COLOR_DARK
  const accentField = isLightTheme ? PRESET_FIELD.ACCENT_COLOR : PRESET_FIELD.ACCENT_COLOR_DARK

  return (
    <div className={s.wrapper}>
      <div className={s.left}>
        <div className={s.head}>
          <div className={s.ballWrapper}>
            <ColorSelector
              activeColor={findPresetColor(primaryColor, theme)}
              customColor={primaryColor}
              allowCustomColor
              onChange={(primaryColor) => {
                if (primaryColor === COLOR.CUSTOM) return

                onThemePresetCommit({ [primaryField]: resolvePresetColor(primaryColor, theme) })
              }}
              onCustomColorChange={(color) => {
                onThemePresetCommit({
                  [primaryField]: color,
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
          <div className={cnMerge(s.ballWrapper, s.subBall, accent('borderSoft'))}>
            <ColorSelector
              activeColor={findPresetColor(accentColor, theme)}
              customColor={accentColor}
              allowCustomColor
              onChange={(accentColor) => {
                if (accentColor === COLOR.CUSTOM) return

                onThemePresetCommit({ [accentField]: resolvePresetColor(accentColor, theme) })
              }}
              onCustomColorChange={(color) => {
                onThemePresetCommit({
                  [accentField]: color,
                })
              }}
            >
              <div className={cnMerge(s.colorBall, s.subColorBall, accent('bg'))} />
            </ColorSelector>
          </div>
          <div className={s.title}>{t('dsb.layout.accent_color.title')}</div>
        </div>
        <p className={s.desc}>{t('dsb.layout.accent_color.desc')}</p>
      </div>
    </div>
  )
}
