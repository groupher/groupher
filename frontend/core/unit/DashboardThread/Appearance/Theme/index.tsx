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
    showDetailsSavingBar,
    showPresetSavingBar,
    details,
    selectPreset,
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

      <DetailsPanel details={details} />

      {showDetailsSavingBar && (
        <div className={s.savingWrapper}>
          <SavingBar isTouched onCancel={cancelAppearance} onConfirm={saveAppearance} />
        </div>
      )}
    </section>
  )
}
