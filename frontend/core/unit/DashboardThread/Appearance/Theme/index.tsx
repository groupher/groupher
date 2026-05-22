'use client'

import { AnimatePresence, domAnimation, LazyMotion, m } from 'motion/react'

import useTrans from '~/hooks/useTrans'
import ThemeSectionSelector from '~/widgets/ThemeSectionSelector'

import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import DetailsPanel from './DetailsPanel'
import useAppearance from './hooks'
import PresetList from './PresetList'
import useSalon from './salon'

const SAVING_SECTION_TRANSITION = {
  duration: 0.18,
  ease: 'easeOut',
} as const

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

      <LazyMotion features={domAnimation}>
        <AnimatePresence initial={false}>
          {showPresetSavingBar && (
            <m.div
              key='theme-preset-saving-bar'
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={SAVING_SECTION_TRANSITION}
              className={s.presetSavingWrapper}
            >
              <SavingBar isTouched onCancel={cancelAppearance} onConfirm={saveAppearance} top={5} />
            </m.div>
          )}
        </AnimatePresence>
      </LazyMotion>

      <DetailsPanel
        details={details}
        showResetMenu={showResetMenu}
        activePresetBase={activePresetBase}
        touched={showDetailsSavingBar}
        onResetPreset={resetCustomPresetTo}
      />

      <LazyMotion features={domAnimation}>
        <AnimatePresence initial={false}>
          {showDetailsSavingBar && (
            <m.div
              key='theme-details-saving-bar'
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={SAVING_SECTION_TRANSITION}
              className={s.savingWrapper}
            >
              <SavingBar isTouched onCancel={cancelAppearance} onConfirm={saveAppearance} />
            </m.div>
          )}
        </AnimatePresence>
      </LazyMotion>
    </section>
  )
}
