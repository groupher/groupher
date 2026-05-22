import THEME from '~/const/theme'
import useTrans from '~/hooks/useTrans'

import { PRESET_FIELD } from '../../../constant'
import useSalon from '../salon/colors'
import type { TThemePresetOverwrite } from '../spec'
import ColorItem from './ColorItem'

type TProps = {
  primaryColor: string
  accentColor: string
  textTitle: string
  textDigest: string
  isLightTheme: boolean
  onThemePresetCommit: (patch: Partial<TThemePresetOverwrite>) => void
}

export default function Colors({
  primaryColor,
  accentColor,
  textTitle,
  textDigest,
  isLightTheme,
  onThemePresetCommit,
}: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const theme = isLightTheme ? THEME.LIGHT : THEME.DARK
  const primaryField = isLightTheme ? PRESET_FIELD.PRIMARY_COLOR : PRESET_FIELD.PRIMARY_COLOR_DARK
  const accentField = isLightTheme ? PRESET_FIELD.ACCENT_COLOR : PRESET_FIELD.ACCENT_COLOR_DARK

  return (
    <div className={s.wrapper}>
      <ColorItem
        color={primaryColor}
        field={primaryField}
        title={t('dsb.appearance.primary_color.label')}
        desc={t('dsb.appearance.primary_color.hint')}
        theme={theme}
        size='large'
        onThemePresetCommit={onThemePresetCommit}
      />

      <ColorItem
        color={accentColor}
        field={accentField}
        title={t('dsb.appearance.accent_color.title')}
        desc={t('dsb.appearance.accent_color.desc')}
        theme={theme}
        onThemePresetCommit={onThemePresetCommit}
      />

      <ColorItem
        color={textTitle}
        field={PRESET_FIELD.TEXT_TITLE}
        title={t('dsb.appearance.title_color.title')}
        desc={t('dsb.appearance.title_color.desc')}
        theme={theme}
        onThemePresetCommit={onThemePresetCommit}
      />

      <ColorItem
        color={textDigest}
        field={PRESET_FIELD.TEXT_DIGEST}
        title={t('dsb.appearance.digest_color.title')}
        desc={t('dsb.appearance.digest_color.desc')}
        theme={theme}
        onThemePresetCommit={onThemePresetCommit}
      />
    </div>
  )
}
