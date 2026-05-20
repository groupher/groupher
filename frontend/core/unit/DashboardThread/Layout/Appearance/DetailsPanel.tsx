import useTrans from '~/hooks/useTrans'

import useSalon from '../../salon/layout/details_panel'
import SectionLabel from '../../SectionLabel'
import CustomBackground from '../PageBackground/CustomBackground'
import type { TPageBgDraft } from '../PageBackground/hooks'
import GlassOpacity from './GlassOpacity'
import PrimaryColors from './PrimaryColors'
import type { TThemePresetOverrides } from './spec'

type TProps = {
  selectedOverrides: TThemePresetOverrides
  selectedPageBgDraft: TPageBgDraft
  primaryCustomColor: string
  isLightTheme: boolean
  pageBgResetKey: string
  onPageBgPreview: (patch: Partial<TPageBgDraft>) => void
  onPageBgCommit: (patch: Partial<TPageBgDraft>) => void
  onThemePresetCommit: (patch: Partial<TThemePresetOverrides>) => void
}

export default function DetailsPanel({
  selectedOverrides,
  selectedPageBgDraft,
  primaryCustomColor,
  isLightTheme,
  pageBgResetKey,
  onPageBgPreview,
  onPageBgCommit,
  onThemePresetCommit,
}: TProps) {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <SectionLabel
          title={t('dsb.layout.appearance.preset.detail')}
          desc={t('dsb.layout.appearance.preset.desc')}
          addon={<span>{t('dsb.layout.appearance.customize')}</span>}
        />
      </div>

      <div className={s.content}>
        <PrimaryColors
          selectedOverrides={selectedOverrides}
          primaryCustomColor={primaryCustomColor}
          isLightTheme={isLightTheme}
          onThemePresetCommit={onThemePresetCommit}
        />

        <div className={s.divider} />

        <CustomBackground
          key={pageBgResetKey}
          draft={selectedPageBgDraft}
          originalDraft={selectedPageBgDraft}
          hueResetKey={pageBgResetKey}
          onDraftChange={onPageBgCommit}
          onPreviewPatch={onPageBgPreview}
          onScheduleCommitPatch={onPageBgCommit}
          showToggle={false}
          showThemeSelector={false}
        />

        <div className={s.divider} />

        <GlassOpacity
          selectedOverrides={selectedOverrides}
          isLightTheme={isLightTheme}
          onThemePresetCommit={onThemePresetCommit}
        />
      </div>
    </div>
  )
}
