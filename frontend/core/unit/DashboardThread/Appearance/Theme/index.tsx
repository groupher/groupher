'use client'

import { useEffect } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TThemePresetOption } from '~/spec'
import useThemePreset from '~/stores/ThemePreset/hooks'
import ThemeSwitchPreview from '~/widgets/ThemeSwitch/Preview'

import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import DetailsPanel from './DetailsPanel'
import useAppearance from './hooks'
import PresetList from './PresetList'
import useSalon from './salon'

type TProps = {
  initialPresetOptions?: readonly TThemePresetOption[]
}

const EMPTY_PRESET_OPTIONS: readonly TThemePresetOption[] = []

export default function Appearance({ initialPresetOptions = EMPTY_PRESET_OPTIONS }: TProps) {
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
    presetOptions,
    customPresetTokens,
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
        addon={<ThemeSwitchPreview />}
        touched={showPresetSavingBar}
      />

      <PresetList
        activePreset={activePreset}
        activePresetBase={activePresetBase}
        presetOptions={presetOptions}
        customTokens={customPresetTokens}
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
        top={6}
        isTouched={showDetailsSavingBar}
        onCancel={cancelAppearance}
        onConfirm={saveAppearance}
      />
    </section>
  )
}
