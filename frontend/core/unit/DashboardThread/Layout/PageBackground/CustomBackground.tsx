import { useEffect, useRef, useState } from 'react'
import { ColorSlider, ColorThumb, parseColor, SliderTrack } from 'react-aria-components'

import { COLOR } from '~/const/colors'
import THEME from '~/const/theme'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import Checker from '~/widgets/Checker'
import RangeInput from '~/widgets/RangeInput'
import ThemeSectionSelector from '~/widgets/ThemeSectionSelector'

import useSalon from '../../salon/layout/page_background/custom_background'
import {
  getThemePageBgState,
  resolveCustomInitPatch,
  resolveLastPresetByTheme,
  resolvePresetRestorePatch,
  type TPageBgDraft,
} from './hooks'

type TProps = {
  draft: TPageBgDraft
  originalDraft: TPageBgDraft
  // Immediate saveable-state update used by low-frequency controls and by the
  // standalone PageBackground page when no preview pipeline is attached.
  onDraftChange: (patch: Partial<TPageBgDraft>) => void
  // High-frequency visual preview. This should only write DOM/CSS vars and must
  // not trigger parent React renders on every pointer move.
  onPreviewPatch?: (patch: Partial<TPageBgDraft>) => void
  // Debounced saveable-state update for high-frequency preview fields. This is
  // what eventually marks the Settings/SavingBar state as touched.
  onScheduleCommitPatch?: (patch: Partial<TPageBgDraft>) => void
  // Immediate saveable-state update for explicit commit boundaries such as
  // pointer-up, blur, Enter, toggle, or picker close.
  onImmediateCommitPatch?: (patch: Partial<TPageBgDraft>) => void
  hueResetKey?: string | number
  showToggle?: boolean
  showThemeSelector?: boolean
}

export default function CustomBackground({
  draft,
  originalDraft,
  onDraftChange,
  onPreviewPatch,
  onScheduleCommitPatch,
  onImmediateCommitPatch,
  hueResetKey,
  showToggle = true,
  showThemeSelector = true,
}: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const { theme } = useTheme()

  const isDarkTheme = theme === THEME.DARK
  const checked = draft.pageBg === COLOR.CUSTOM || draft.pageBgDark === COLOR.CUSTOM
  const {
    pageBg,
    pageCustomBg: hue,
    pageCustomIntensity: intensity,
  } = getThemePageBgState(draft, theme)
  const [localHue, setLocalHue] = useState(hue)
  const [localIntensity, setLocalIntensity] = useState(intensity)
  const hueRef = useRef(hue)
  const intensityRef = useRef(intensity)
  const hasPreviewPatch = !!onPreviewPatch
  const displayHue = hasPreviewPatch ? localHue : hue
  const displayIntensity = hasPreviewPatch ? localIntensity : intensity
  const hueColor = parseColor(`hsl(${displayHue}, 100%, 50%)`)
  const lastPresetByThemeRef = useRef(resolveLastPresetByTheme(draft, originalDraft))

  useEffect(() => {
    setLocalHue(hue)
    setLocalIntensity(intensity)
    hueRef.current = hue
    intensityRef.current = intensity
  }, [hue, intensity, theme])

  useEffect(() => {
    if (draft.pageBg !== COLOR.CUSTOM) {
      lastPresetByThemeRef.current.light = draft.pageBg
    }

    if (draft.pageBgDark !== COLOR.CUSTOM) {
      lastPresetByThemeRef.current.dark = draft.pageBgDark
    }
  }, [draft.pageBg, draft.pageBgDark])

  const initCurrentThemeCustom = () => {
    const patch = resolveCustomInitPatch(draft, theme)
    if (patch) onDraftChange(patch)
  }
  const getCustomPatch = (nextHue: number, nextIntensity: number) =>
    isDarkTheme
      ? {
          pageBgDark: COLOR.CUSTOM,
          pageCustomBgDark: nextHue,
          pageCustomIntensityDark: nextIntensity,
        }
      : { pageBg: COLOR.CUSTOM, pageCustomBg: nextHue, pageCustomIntensity: nextIntensity }

  const handleHueChange = (value: number) => {
    hueRef.current = value
    setLocalHue(value)
    const patch = getCustomPatch(value, intensityRef.current)

    if (onPreviewPatch) {
      onPreviewPatch(patch)
      onScheduleCommitPatch?.(patch)
      return
    }

    onDraftChange(patch)
  }

  const handleIntensityChange = (value: number) => {
    setLocalIntensity(value)
    intensityRef.current = value
    const patch = getCustomPatch(hueRef.current, value)

    if (onPreviewPatch) {
      onPreviewPatch(patch)
      onScheduleCommitPatch?.(patch)
      return
    }

    onDraftChange(patch)
  }

  const handleIntensityCommit = (value: number) => {
    const patch = getCustomPatch(hueRef.current, value)
    onImmediateCommitPatch?.(patch)
    onScheduleCommitPatch?.(patch)
  }

  useEffect(() => {
    if (!checked) return

    if (pageBg !== COLOR.CUSTOM) {
      initCurrentThemeCustom()
    }
  }, [checked, pageBg, theme])

  return (
    <div className={s.wrapper}>
      {showToggle && (
        <div className={s.enableRow}>
          <Checker
            checked={checked}
            aria-label='toggle custom background'
            onChange={(nextChecked) => {
              if (nextChecked) {
                initCurrentThemeCustom()
                return
              }

              onDraftChange(
                resolvePresetRestorePatch(
                  lastPresetByThemeRef.current.light,
                  lastPresetByThemeRef.current.dark,
                ),
              )
            }}
          >
            {t('dsb.layout.page_background.custom.toggle')}
          </Checker>
        </div>
      )}

      {checked && (
        <>
          {showThemeSelector && (
            <div className={s.selectorRow}>
              <ThemeSectionSelector />
            </div>
          )}

          <div className={s.inner}>
            <div className={s.settingRow}>
              <div className={s.labelGroup}>
                <div className={s.label}>{t('dsb.layout.page_background.custom.hue')}</div>
                <div className={s.hint}>{t('dsb.layout.page_background.custom.hue_desc')}</div>
              </div>

              <div className='grow' />
              <div className={s.controlGroup}>
                <ColorSlider
                  key={`${theme}-${hueResetKey ?? hue}`}
                  aria-label='Page background hue'
                  className={s.slider}
                  defaultValue={hueColor}
                  colorSpace='hsb'
                  channel='hue'
                  onChange={(color) => {
                    handleHueChange(color.getChannelValue('hue'))
                  }}
                >
                  <SliderTrack className={s.sliderTrack}>
                    <ColorThumb className={s.colorThumb} />
                  </SliderTrack>
                </ColorSlider>
              </div>
            </div>

            <div className={s.settingRow}>
              <div className={s.labelGroup}>
                <div className={s.label}>{t('dsb.layout.page_background.custom.intensity')}</div>
                <div className={s.hint}>
                  {t('dsb.layout.page_background.custom.intensity_desc')}
                </div>
              </div>
              <div className='grow' />
              <div className={s.rangeGroup}>
                <RangeInput
                  value={displayIntensity}
                  valueLabel='strength'
                  min={0}
                  max={100}
                  step={0.1}
                  unit='%'
                  top={0}
                  aria-label='Page background tint strength'
                  onChange={handleIntensityChange}
                  onChangeEnd={handleIntensityCommit}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
