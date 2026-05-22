import useTrans from '~/hooks/useTrans'
import ThemeSectionSelector from '~/widgets/ThemeSectionSelector'

import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import DetailsPanel from './DetailsPanel'
import useAppearance from './hooks'
import PresetList from './PresetList'
import useSalon from './salon'

export default function Appearance() {
  const { t } = useTrans()
  const s = useSalon()
  const {
    activePreset,
    activePresetBase,
    hasCustomThemePreset,
    customPresetOverwrite,
    showForkRelation,
    selectedOverwrite,
    selectedPageBgDraft,
    showDetailsSavingBar,
    showPresetSavingBar,
    isLightTheme,
    primaryColor,
    accentColor,
    selectPreset,
    previewPageBg,
    previewThemePresetPatch,
    scheduleThemePresetPatch,
    flushThemePresetPreviewCommit,
    commitThemePresetPatch,
    pageBgResetKey,
    saveAppearance,
    cancelAppearance,
  } = useAppearance()

  return (
    <section>
      <SectionLabel
        title={t('dsb.appearance.theme.title')}
        desc={t('dsb.appearance.theme.desc')}
        addon={<ThemeSectionSelector />}
      />

      <PresetList
        activePreset={activePreset}
        activePresetBase={activePresetBase}
        hasCustomPreset={hasCustomThemePreset}
        customOverwrite={customPresetOverwrite}
        showForkRelation={showForkRelation}
        onSelect={selectPreset}
      />

      {showPresetSavingBar && (
        <div className={s.presetSavingWrapper}>
          <SavingBar isTouched onCancel={cancelAppearance} onConfirm={saveAppearance} top={5} />
        </div>
      )}

      <DetailsPanel
        selectedOverwrite={selectedOverwrite}
        selectedPageBgDraft={selectedPageBgDraft}
        primaryColor={primaryColor}
        accentColor={accentColor}
        isLightTheme={isLightTheme}
        pageBgResetKey={pageBgResetKey}
        onPageBgPreview={previewPageBg}
        onPageBgCommit={scheduleThemePresetPatch}
        onThemePresetPreview={previewThemePresetPatch}
        onThemePresetSchedule={scheduleThemePresetPatch}
        onThemePresetFlush={flushThemePresetPreviewCommit}
        onThemePresetCommit={commitThemePresetPatch}
      />

      {showDetailsSavingBar && (
        <div className={s.savingWrapper}>
          <SavingBar isTouched onCancel={cancelAppearance} onConfirm={saveAppearance} />
        </div>
      )}
    </section>
  )
}
