import { startTransition, useEffect, useRef } from 'react'
import { ColorSlider, ColorThumb, parseColor, SliderTrack } from 'react-aria-components'
import { COLOR, PAGE_BG_CSS_KEY, PAGE_BG_DEFAULT } from '~/const/colors'
import THEME from '~/const/theme'
import { getCSSVar } from '~/css'
import { camelize } from '~/fmt'
import useCSSVar from '~/hooks/useCssVar'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import { getPageBgCustomParamsFromHex } from '~/lib/color'
import useDashboard from '~/stores/dashboard/hooks'
import Checker from '~/widgets/Checker'
import RangeSlider from '~/widgets/RangeSlider'
import ThemeSectionSelector from '~/widgets/ThemeSectionSelector'
import { FIELD } from '../../constant'
import useHelper from '../../logic/useHelper'
import useSalon from '../../salon/layout/page_background/custom_background'
import type { TDsbFieldKey } from '../../spec'

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

const resolveInitialPreset = (
  current: string,
  original: string,
  fallback: string,
): string => {
  if (current !== COLOR.CUSTOM) return current
  if (original !== COLOR.CUSTOM) return original
  return fallback
}

export default function CustomBackground() {
  const s = useSalon()
  const dsb$ = useDashboard()
  const { edit } = useHelper()
  const { t } = useTrans()
  const { theme } = useTheme()

  const isDarkTheme = theme === THEME.DARK
  const pageBgField = isDarkTheme ? FIELD.PAGE_BG_DARK : FIELD.PAGE_BG
  const customBgField = isDarkTheme ? FIELD.PAGE_CUSTOM_BG_DARK : FIELD.PAGE_CUSTOM_BG
  const customIntensityField = isDarkTheme
    ? FIELD.PAGE_CUSTOM_INTENSITY_DARK
    : FIELD.PAGE_CUSTOM_INTENSITY

  const lightChecked = dsb$.pageBg === COLOR.CUSTOM
  const darkChecked = dsb$.pageBgDark === COLOR.CUSTOM
  const checked = lightChecked || darkChecked
  const hue = dsb$[customBgField]
  const intensity = dsb$[customIntensityField]
  const hueColor = parseColor(`hsl(${hue}, 100%, 50%)`)
  const rawPageBg = useCSSVar(PAGE_BG_CSS_KEY, [pageBgField, customBgField, customIntensityField], {
    selector: 'main',
  })
  const frameRef = useRef<number | null>(null)
  const patchRef = useRef<Partial<Record<TDsbFieldKey, number>>>({})
  const lastPresetRef = useRef({
    light: resolveInitialPreset(dsb$.pageBg, dsb$.original.pageBg, PAGE_BG_DEFAULT[THEME.LIGHT]),
    dark: resolveInitialPreset(
      dsb$.pageBgDark,
      dsb$.original.pageBgDark,
      PAGE_BG_DEFAULT[THEME.DARK],
    ),
  })

  const ensureCustomMode = () => {
    if (dsb$[pageBgField] !== COLOR.CUSTOM) {
      edit(COLOR.CUSTOM, pageBgField)
    }
  }

  const queueEdit = (field: TDsbFieldKey, value: number) => {
    patchRef.current[field] = value

    if (frameRef.current !== null) return

    frameRef.current = window.requestAnimationFrame(() => {
      const patch = { ...patchRef.current }
      patchRef.current = {}
      frameRef.current = null

      startTransition(() => {
        Object.entries(patch).forEach(([key, nextValue]) => {
          edit(nextValue, key as TDsbFieldKey)
        })
      })
    })
  }

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (dsb$.pageBg !== COLOR.CUSTOM) {
      lastPresetRef.current.light = dsb$.pageBg
    }

    if (dsb$.pageBgDark !== COLOR.CUSTOM) {
      lastPresetRef.current.dark = dsb$.pageBgDark
    }
  }, [dsb$.pageBg, dsb$.pageBgDark])

  const initCustomForTheme = (targetTheme: string) => {
    const targetIsDark = targetTheme === THEME.DARK
    const targetPageBgField = targetIsDark ? FIELD.PAGE_BG_DARK : FIELD.PAGE_BG
    const targetCustomBgField = targetIsDark ? FIELD.PAGE_CUSTOM_BG_DARK : FIELD.PAGE_CUSTOM_BG
    const targetCustomIntensityField = targetIsDark
      ? FIELD.PAGE_CUSTOM_INTENSITY_DARK
      : FIELD.PAGE_CUSTOM_INTENSITY
    const currentPresetBg = targetIsDark ? dsb$.pageBgDark : dsb$.pageBg

    if (currentPresetBg === COLOR.CUSTOM) return

    const fallbackPresetBg = SOLARIZED_PAGE_BG[targetTheme]
    const shouldInferFromCurrentBg = COLORED_PAGE_BG[targetTheme].has(currentPresetBg)
    const sourcePresetBg = shouldInferFromCurrentBg ? currentPresetBg : fallbackPresetBg
    const sourceHex =
      getCSSVar(`color-page-${camelize(sourcePresetBg)}`) ??
      getCSSVar(`color-page-${camelize(fallbackPresetBg)}`) ??
      rawPageBg
    const { hue: nextHue, intensity: nextIntensity } = getPageBgCustomParamsFromHex(
      sourceHex,
      targetTheme,
    )

    edit(nextHue, targetCustomBgField)
    edit(nextIntensity, targetCustomIntensityField)
    edit(COLOR.CUSTOM, targetPageBgField)
  }

  useEffect(() => {
    if (!checked) return
    if (dsb$[pageBgField] === COLOR.CUSTOM) return

    initCustomForTheme(theme)
  }, [checked, dsb$, pageBgField, theme, initCustomForTheme])

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

            edit(lastPresetRef.current.light, FIELD.PAGE_BG)
            edit(lastPresetRef.current.dark, FIELD.PAGE_BG_DARK)
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
                    ensureCustomMode()
                    queueEdit(customBgField, Math.round(color.getChannelValue('hue')))
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
                  unit='%'
                  top={0}
                  onChange={(value) => {
                    ensureCustomMode()
                    queueEdit(customIntensityField, value)
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
