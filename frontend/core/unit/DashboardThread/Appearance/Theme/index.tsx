'use client'

import { useEffect } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TThemePresetOption } from '~/spec'
import useThemePreset from '~/stores/ThemePreset/hooks'
import ThemeSectionSelector from '~/widgets/ThemeSectionSelector'

import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import DetailsPanel from './DetailsPanel'
import useAppearance from './hooks'
import PresetList from './PresetList'
import useSalon from './salon'

type TProps = {
  initialPresetOptions?: readonly TThemePresetOption[]
}

export default function Appearance({ initialPresetOptions = [] }: TProps) {
  const { t } = useTrans()
  const s = useSalon()
  const themePreset$ = useThemePreset()
  const storedPresetOptions = themePreset$.presetOptions
  const hydratePresetOptions = themePreset$.hydratePresetOptions

  useEffect(() => {
    if (initialPresetOptions.length === 0 || storedPresetOptions.length > 0) return

    hydratePresetOptions?.(initialPresetOptions)
  }, [hydratePresetOptions, initialPresetOptions, storedPresetOptions.length])

  const {
    activePreset,
    activePresetBase,
    hasCustomThemePreset,
    presetOptions,
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
  } = useAppearance({ initialPresetOptions })

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
        presetOptions={presetOptions}
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
        presetOptions={presetOptions}
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
