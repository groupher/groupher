import useTrans from '~/hooks/useTrans'
import CustomPageBg, { type TPageBgDraft } from '~/widgets/CustomPageBg'

import SectionLabel from '../../SectionLabel'
import GlassOpacity from './GlassOpacity'
import PageGlow from './PageGlow'
import PrimaryColors from './PrimaryColors'
import useSalon from './salon/details_panel'
import type { TThemePresetOverwrite } from './spec'

type TProps = {
  selectedOverwrite: TThemePresetOverwrite
  selectedPageBgDraft: TPageBgDraft
  primaryColor: string
  accentColor: string
  isLightTheme: boolean
  pageBgResetKey: string
  onPageBgPreview: (patch: Partial<TPageBgDraft>) => void
  onPageBgCommit: (patch: Partial<TPageBgDraft>) => void
  onThemePresetPreview: (patch: Partial<TThemePresetOverwrite>) => void
  onThemePresetSchedule: (patch: Partial<TThemePresetOverwrite>) => void
  onThemePresetFlush: () => void
  onThemePresetCommit: (patch: Partial<TThemePresetOverwrite>) => void
}

export default function DetailsPanel({
  selectedOverwrite,
  selectedPageBgDraft,
  primaryColor,
  accentColor,
  isLightTheme,
  pageBgResetKey,
  onPageBgPreview,
  onPageBgCommit,
  onThemePresetPreview,
  onThemePresetSchedule,
  onThemePresetFlush,
  onThemePresetCommit,
}: TProps) {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <SectionLabel
          title={t('dsb.appearance.theme.preset.detail')}
          desc={t('dsb.appearance.theme.preset.desc')}
          addon={<span>{t('dsb.appearance.theme.customize')}</span>}
        />
      </div>

      <div className={s.content}>
        <PrimaryColors
          primaryColor={primaryColor}
          accentColor={accentColor}
          isLightTheme={isLightTheme}
          onThemePresetCommit={onThemePresetCommit}
        />
        <div className={s.divider} />

        <CustomPageBg
          key={pageBgResetKey}
          draft={selectedPageBgDraft}
          hueResetKey={pageBgResetKey}
          onDraftChange={onPageBgCommit}
          onPreviewPatch={onPageBgPreview}
          onScheduleCommitPatch={onPageBgCommit}
          showToggle={false}
          showThemeSelector={false}
        />

        <GlassOpacity
          selectedOverwrite={selectedOverwrite}
          isLightTheme={isLightTheme}
          onThemePresetPreview={onThemePresetPreview}
          onThemePresetSchedule={onThemePresetSchedule}
          onThemePresetFlush={onThemePresetFlush}
        />

        <div className={s.divider} />

        <PageGlow
          selectedOverwrite={selectedOverwrite}
          onThemePresetPreview={onThemePresetPreview}
          onThemePresetSchedule={onThemePresetSchedule}
          onThemePresetFlush={onThemePresetFlush}
          onThemePresetCommit={onThemePresetCommit}
        />
      </div>
    </div>
  )
}
