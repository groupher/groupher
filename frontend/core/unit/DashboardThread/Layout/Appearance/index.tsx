import useTrans from '~/hooks/useTrans'
import ThemeSectionSelector from '~/widgets/ThemeSectionSelector'

import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import DetailsPanel from './DetailsPanel'
import useAppearance from './hooks'
import PresetList from './PresetList'
import useSalon from './salon/details_panel'

export default function Appearance() {
  const { t } = useTrans()
  const s = useSalon()
  const {
    activePreset,
    selectedOverrides,
    selectedPageBgDraft,
    isTouched,
    isLightTheme,
    primaryCustomColor,
    selectPreset,
    previewPageBg,
    scheduleThemePresetPatch,
    commitThemePresetPatch,
    pageBgResetKey,
    saveAppearance,
    cancelAppearance,
  } = useAppearance()

  return (
    <section>
      <SectionLabel
        title={t('dsb.layout.appearance.title')}
        desc={t('dsb.layout.appearance.desc')}
        addon={<ThemeSectionSelector />}
      />

      <PresetList activePreset={activePreset} onSelect={selectPreset} />

      <DetailsPanel
        selectedOverrides={selectedOverrides}
        selectedPageBgDraft={selectedPageBgDraft}
        primaryCustomColor={primaryCustomColor}
        isLightTheme={isLightTheme}
        pageBgResetKey={pageBgResetKey}
        onPageBgPreview={previewPageBg}
        onPageBgCommit={scheduleThemePresetPatch}
        onThemePresetCommit={commitThemePresetPatch}
      />

      {isTouched && (
        <div className={s.savingWrapper}>
          <SavingBar isTouched onCancel={cancelAppearance} onConfirm={saveAppearance} />
        </div>
      )}
    </section>
  )
}
