import { useEffect, useRef } from 'react'
import { ColorSlider, ColorThumb, parseColor, SliderTrack } from 'react-aria-components'
import { COLOR } from '~/const/colors'
import THEME from '~/const/theme'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import Checker from '~/widgets/Checker'
import RangeSlider from '~/widgets/RangeSlider'
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
  onDraftChange: (patch: Partial<TPageBgDraft>) => void
}

export default function CustomBackground({ draft, originalDraft, onDraftChange }: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const { theme } = useTheme()

  const isDarkTheme = theme === THEME.DARK
  const checked = draft.pageBg === COLOR.CUSTOM || draft.pageBgDark === COLOR.CUSTOM
  const { pageBg, pageCustomBg: hue, pageCustomIntensity: intensity } = getThemePageBgState(
    draft,
    theme,
  )
  const hueColor = parseColor(`hsl(${hue}, 100%, 50%)`)
  const lastPresetByThemeRef = useRef(resolveLastPresetByTheme(draft, originalDraft))

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (!checked) return

    if (pageBg !== COLOR.CUSTOM) {
      initCurrentThemeCustom()
    }
  }, [checked, pageBg, theme])

  return (
    <div className={s.wrapper}>
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

      {checked && (
        <>
          <div className={s.selectorRow}>
            <ThemeSectionSelector />
          </div>

          <div className={s.inner}>
            <div className={s.settingRow}>
              <div className={s.labelGroup}>
                <div className={s.label}>{t('dsb.layout.page_background.custom.hue')}</div>
                <div className={s.hint}>{t('dsb.layout.page_background.custom.hue_desc')}</div>
              </div>

              <div className='grow' />
              <div className={s.controlGroup}>
                <ColorSlider
                  aria-label='Page background hue'
                  className={s.slider}
                  style={{ ['--thumb-color' as string]: hueColor.toString('hex') }}
                  value={hueColor}
                  colorSpace='hsb'
                  channel='hue'
                  onChange={(color) => {
                    onDraftChange(
                      isDarkTheme
                        ? {
                            pageBgDark: COLOR.CUSTOM,
                            pageCustomBgDark: color.getChannelValue('hue'),
                          }
                        : {
                            pageBg: COLOR.CUSTOM,
                            pageCustomBg: color.getChannelValue('hue'),
                          },
                    )
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
                <RangeSlider
                  value={intensity}
                  min={0}
                  max={100}
                  step={0.1}
                  unit='%'
                  top={0}
                  onChange={(value) => {
                    onDraftChange(
                      isDarkTheme
                        ? { pageBgDark: COLOR.CUSTOM, pageCustomIntensityDark: value }
                        : { pageBg: COLOR.CUSTOM, pageCustomIntensity: value },
                    )
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
