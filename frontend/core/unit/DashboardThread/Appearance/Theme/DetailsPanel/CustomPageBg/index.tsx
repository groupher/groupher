import { ColorSlider, ColorThumb, parseColor, SliderTrack } from 'react-aria-components'

import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import Checker from '~/widgets/Checker'
import RangeInput from '~/widgets/RangeInput'
import ThemeSwitchPreview from '~/widgets/ThemeSwitch/Preview'

import { type TPageBgDraft, useCustomPageBgControls } from './hooks'
import useSalon from './salon'

export type { TPageBgDraft } from './hooks'

type TProps = {
  draft: TPageBgDraft
  // Immediate saveable-state update used by low-frequency controls.
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

export default function CustomPageBg({
  draft,
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
  const {
    checked,
    displayHue,
    displayIntensity,
    hueResetValue,
    handleHueChange,
    handleIntensityChange,
    handleIntensityCommit,
    handleToggleChange,
  } = useCustomPageBgControls({
    draft,
    theme,
    onDraftChange,
    onPreviewPatch,
    onScheduleCommitPatch,
    onImmediateCommitPatch,
  })
  const hueColor = parseColor(`hsl(${displayHue}, 100%, 50%)`)

  return (
    <>
      {showToggle && (
        <div className={s.enableRow}>
          <Checker
            checked={checked}
            aria-label={t('dsb.appearance.custom_page_bg.toggle')}
            onChange={handleToggleChange}
          >
            {t('dsb.appearance.custom_page_bg.toggle')}
          </Checker>
        </div>
      )}

      {checked && (
        <>
          {showThemeSelector && (
            <div className={s.selectorRow}>
              <ThemeSwitchPreview />
            </div>
          )}

          <div className={s.inner}>
            <div className={s.settingRow}>
              <div className={s.labelGroup}>
                <div className={s.label}>{t('dsb.appearance.custom_page_bg.hue')}</div>
                <div className={s.hint}>{t('dsb.appearance.custom_page_bg.hue_desc')}</div>
              </div>

              <div className='grow' />
              <div className={s.controlGroup}>
                <ColorSlider
                  key={`${theme}-${hueResetKey ?? hueResetValue}`}
                  aria-label={t('dsb.appearance.custom_page_bg.hue')}
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
                <div className={s.label}>{t('dsb.appearance.custom_page_bg.intensity')}</div>
                <div className={s.hint}>{t('dsb.appearance.custom_page_bg.intensity_desc')}</div>
              </div>
              <div className='grow' />
              <div className={s.rangeGroup}>
                <RangeInput
                  value={displayIntensity}
                  valueLabel={t('dsb.appearance.custom_page_bg.intensity')}
                  min={0}
                  max={100}
                  step={1}
                  unit='%'
                  top={0}
                  aria-label={t('dsb.appearance.custom_page_bg.intensity')}
                  onChange={handleIntensityChange}
                  onChangeEnd={handleIntensityCommit}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
