'use client'

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
    showResetMenu,
    showDetailsSavingBar,
    showPresetSavingBar,
    details,
    selectPreset,
    resetCustomPresetTo,
    saveAppearance,
    cancelAppearance,
  } = useAppearance()

  return (
    <section>
      <SectionLabel
        title={t('dsb.appearance.theme.title')}
        desc={t('dsb.appearance.theme.desc')}
        addon={<ThemeSectionSelector />}
        touched={showPresetSavingBar}
      />

      <PresetList
        activePreset={activePreset}
        activePresetBase={activePresetBase}
        hasCustomPreset={hasCustomThemePreset}
        customOverwrite={customPresetOverwrite}
        showForkRelation={showForkRelation}
        onSelect={selectPreset}
      />

      <SavingBar
        isTouched={showPresetSavingBar}
        wrapperClassName={s.presetSavingWrapper}
        onCancel={cancelAppearance}
        onConfirm={saveAppearance}
        top={5}
      />

      <DetailsPanel
        details={details}
        showResetMenu={showResetMenu}
        activePresetBase={activePresetBase}
        touched={showDetailsSavingBar}
        onResetPreset={resetCustomPresetTo}
      />

      <SavingBar
        isTouched={showDetailsSavingBar}
        wrapperClassName={s.savingWrapper}
        onCancel={cancelAppearance}
        onConfirm={saveAppearance}
      />
    </section>
  )
}
