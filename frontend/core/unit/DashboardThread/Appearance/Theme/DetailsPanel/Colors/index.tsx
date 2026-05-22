import THEME from '~/const/theme'
import useTrans from '~/hooks/useTrans'

import { PRESET_FIELD } from '../../../../constant'
import useSalon from '../../salon/details_panel/colors'
import type { TThemeDetails } from '../../spec'
import ColorItem from './ColorItem'

type TProps = {
  details: TThemeDetails
}

export default function Colors({ details }: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const { selectedOverwrite, primaryColor, accentColor, isLightTheme, onThemePresetCommit } =
    details
  const { textTitle, textTitleDark, textDigest, textDigestDark } = selectedOverwrite
  const theme = isLightTheme ? THEME.LIGHT : THEME.DARK
  const primaryField = isLightTheme ? PRESET_FIELD.PRIMARY_COLOR : PRESET_FIELD.PRIMARY_COLOR_DARK
  const accentField = isLightTheme ? PRESET_FIELD.ACCENT_COLOR : PRESET_FIELD.ACCENT_COLOR_DARK
  const titleColor = isLightTheme ? textTitle : textTitleDark
  const titleField = isLightTheme ? PRESET_FIELD.TEXT_TITLE : PRESET_FIELD.TEXT_TITLE_DARK
  const digestColor = isLightTheme ? textDigest : textDigestDark
  const digestField = isLightTheme ? PRESET_FIELD.TEXT_DIGEST : PRESET_FIELD.TEXT_DIGEST_DARK

  return (
    <div className={s.wrapper}>
      <ColorItem
        color={primaryColor}
        field={primaryField}
        title={t('dsb.appearance.primary_color.label')}
        desc={t('dsb.appearance.primary_color.hint')}
        theme={theme}
        isLarge
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
        color={titleColor}
        field={titleField}
        title={t('dsb.appearance.title_color.title')}
        desc={t('dsb.appearance.title_color.desc')}
        theme={theme}
        onThemePresetCommit={onThemePresetCommit}
      />

      <ColorItem
        color={digestColor}
        field={digestField}
        title={t('dsb.appearance.digest_color.title')}
        desc={t('dsb.appearance.digest_color.desc')}
        theme={theme}
        onThemePresetCommit={onThemePresetCommit}
      />
    </div>
  )
}
