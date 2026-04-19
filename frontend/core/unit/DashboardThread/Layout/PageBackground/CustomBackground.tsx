import { useEffect, useRef, useState } from 'react'
import { ColorSlider, ColorThumb, parseColor, SliderTrack } from 'react-aria-components'
import { COLOR, PAGE_BG_COLOR_HEX, PAGE_BG_DEFAULT } from '~/const/colors'
import THEME from '~/const/theme'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import { getPageBgCustomParamsFromHex } from '~/lib/color'
import Checker from '~/widgets/Checker'
import RangeSlider from '~/widgets/RangeSlider'
import ThemeSectionSelector from '~/widgets/ThemeSectionSelector'
import useSalon from '../../salon/layout/page_background/custom_background'

const COLORED_PAGE_BG = {
  [THEME.LIGHT]: new Set(['mint white', 'pink', 'todo2', 'blue2', 'purple', 'todo']),
  [THEME.DARK]: new Set([
    'ubuntu',
    'obsidian',
    'solarized dark',
    'oxford blue',
    'daylight green',
    'arsenic',
  ]),
} as const

const SOLARIZED_PAGE_BG = {
  [THEME.LIGHT]: 'solarized',
  [THEME.DARK]: 'solarized dark',
} as const

export type TPageBgDraft = {
  pageBg: string
  pageBgDark: string
  pageCustomBg: number
  pageCustomBgDark: number
  pageCustomIntensity: number
  pageCustomIntensityDark: number
}

type TProps = {
  draft: TPageBgDraft
  originalDraft: TPageBgDraft
  onDraftChange: (patch: Partial<TPageBgDraft>) => void
}

const resolveInitialPreset = (current: string, original: string, fallback: string): string => {
  if (current !== COLOR.CUSTOM) return current
  if (original !== COLOR.CUSTOM) return original
  return fallback
}

export default function CustomBackground({ draft, originalDraft, onDraftChange }: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const { theme } = useTheme()

  const isDarkTheme = theme === THEME.DARK
  const checked = draft.pageBg === COLOR.CUSTOM || draft.pageBgDark === COLOR.CUSTOM
  const hue = isDarkTheme ? draft.pageCustomBgDark : draft.pageCustomBg
  const intensity = isDarkTheme ? draft.pageCustomIntensityDark : draft.pageCustomIntensity
  const hueColor = parseColor(`hsl(${hue}, 100%, 50%)`)
  const [dummyHue, setDummyHue] = useState(hue)
  const [dummyIntensity, setDummyIntensity] = useState(intensity)
  const dummyHueColor = parseColor(`hsl(${dummyHue}, 100%, 50%)`)
  const lastPresetRef = useRef({
    light: resolveInitialPreset(
      draft.pageBg,
      originalDraft.pageBg,
      PAGE_BG_DEFAULT[THEME.LIGHT],
    ),
    dark: resolveInitialPreset(
      draft.pageBgDark,
      originalDraft.pageBgDark,
      PAGE_BG_DEFAULT[THEME.DARK],
    ),
  })

  useEffect(() => {
    if (draft.pageBg !== COLOR.CUSTOM) {
      lastPresetRef.current.light = draft.pageBg
    }

    if (draft.pageBgDark !== COLOR.CUSTOM) {
      lastPresetRef.current.dark = draft.pageBgDark
    }
  }, [draft.pageBg, draft.pageBgDark])

  useEffect(() => {
    setDummyHue(hue)
    setDummyIntensity(intensity)
  }, [hue, intensity])

  const initCustomForTheme = (targetTheme: string) => {
    const targetIsDark = targetTheme === THEME.DARK
    const targetPageBg = targetIsDark ? draft.pageBgDark : draft.pageBg

    if (targetPageBg === COLOR.CUSTOM) return

    const fallbackPresetBg = SOLARIZED_PAGE_BG[targetTheme]
    const shouldInferFromCurrentBg = COLORED_PAGE_BG[targetTheme].has(targetPageBg)
    const sourcePresetBg = shouldInferFromCurrentBg ? targetPageBg : fallbackPresetBg
    const sourceHex = PAGE_BG_COLOR_HEX[sourcePresetBg] || PAGE_BG_COLOR_HEX[fallbackPresetBg]
    const { hue: nextHue, intensity: nextIntensity } = getPageBgCustomParamsFromHex(
      sourceHex,
      targetTheme,
    )

    if (targetIsDark) {
      onDraftChange({
        pageBgDark: COLOR.CUSTOM,
        pageCustomBgDark: nextHue,
        pageCustomIntensityDark: nextIntensity,
      })
      return
    }

    onDraftChange({
      pageBg: COLOR.CUSTOM,
      pageCustomBg: nextHue,
      pageCustomIntensity: nextIntensity,
    })
  }

  useEffect(() => {
    if (!checked) return

    if (isDarkTheme && draft.pageBgDark !== COLOR.CUSTOM) {
      initCustomForTheme(THEME.DARK)
    }

    if (!isDarkTheme && draft.pageBg !== COLOR.CUSTOM) {
      initCustomForTheme(THEME.LIGHT)
    }
  }, [checked, draft.pageBg, draft.pageBgDark, isDarkTheme])

  return (
    <div className={s.wrapper}>
      <div className={s.enableRow}>
        <Checker
          checked={checked}
          aria-label='toggle custom background'
          onChange={(nextChecked) => {
            if (nextChecked) {
              initCustomForTheme(theme)
              return
            }

            onDraftChange({
              pageBg: lastPresetRef.current.light,
              pageBgDark: lastPresetRef.current.dark,
            })
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

          <div className={s.selectorRow}>
            <div className={s.hint}>Dummy slider compare</div>
          </div>

          <div className={s.inner}>
            <div className={s.settingRow}>
              <div className={s.labelGroup}>
                <div className={s.label}>Dummy Hue</div>
                <div className={s.hint}>Local state only, does not update page background</div>
              </div>

              <div className='grow' />
              <div className={s.controlGroup}>
                <ColorSlider
                  aria-label='Dummy page background hue'
                  className={s.slider}
                  style={{ ['--thumb-color' as string]: dummyHueColor.toString('hex') }}
                  value={dummyHueColor}
                  colorSpace='hsb'
                  channel='hue'
                  onChange={(color) => {
                    setDummyHue(color.getChannelValue('hue'))
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
                <div className={s.label}>Dummy Intensity</div>
                <div className={s.hint}>Local state only, does not update page background</div>
              </div>
              <div className='grow' />
              <div className={s.rangeGroup}>
                <RangeSlider
                  value={dummyIntensity}
                  min={0}
                  max={100}
                  step={0.1}
                  unit='%'
                  top={0}
                  onChange={(value) => {
                    setDummyIntensity(value)
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
