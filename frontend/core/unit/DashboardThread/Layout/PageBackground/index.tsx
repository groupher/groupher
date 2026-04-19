import { useEffect, useMemo, useState } from 'react'
import { COLOR, PAGE_BG_COLOR_HEX } from '~/const/colors'
import { blurRGB, camelize, titleCaseHM } from '~/fmt'
import useDidMount from '~/hooks/useDidMount'
import useGaussBlur from '~/hooks/useGaussBlur'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import CheckSVG from '~/icons/Check'
import { getPageBgCustomColor } from '~/lib/color'
import useDashboard from '~/stores/dashboard/hooks'
import { FIELD } from '../../constant'
import useHelper from '../../logic/useHelper'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cn } from '../../salon/layout/page_background'
import CustomBackground, { type TPageBgDraft } from './CustomBackground'

const buildDraft = (source: TPageBgDraft): TPageBgDraft => ({
  pageBg: source.pageBg,
  pageBgDark: source.pageBgDark,
  pageCustomBg: source.pageCustomBg,
  pageCustomBgDark: source.pageCustomBgDark,
  pageCustomIntensity: source.pageCustomIntensity,
  pageCustomIntensityDark: source.pageCustomIntensityDark,
})

const resolveRawBg = (draft: TPageBgDraft, isLightTheme: boolean) => {
  const currentPageBg = isLightTheme ? draft.pageBg : draft.pageBgDark

  if (currentPageBg === COLOR.CUSTOM) {
    return isLightTheme
      ? getPageBgCustomColor('light', draft.pageCustomBg, draft.pageCustomIntensity)
      : getPageBgCustomColor('dark', draft.pageCustomBgDark, draft.pageCustomIntensityDark)
  }

  return PAGE_BG_COLOR_HEX[currentPageBg] || ''
}

export default function PageBackground() {
  const dsb$ = useDashboard()
  const { onSave } = useHelper()
  const mounted = useDidMount()
  const s = useSalon()
  const { isLightTheme } = useTheme()
  const { t } = useTrans()
  const gaussBlur = useGaussBlur()

  const storeDraft = useMemo(
    () =>
      buildDraft({
        pageBg: dsb$.pageBg,
        pageBgDark: dsb$.pageBgDark,
        pageCustomBg: dsb$.pageCustomBg,
        pageCustomBgDark: dsb$.pageCustomBgDark,
        pageCustomIntensity: dsb$.pageCustomIntensity,
        pageCustomIntensityDark: dsb$.pageCustomIntensityDark,
      }),
    [
      dsb$.pageBg,
      dsb$.pageBgDark,
      dsb$.pageCustomBg,
      dsb$.pageCustomBgDark,
      dsb$.pageCustomIntensity,
      dsb$.pageCustomIntensityDark,
    ],
  )

  const originalDraft = useMemo(
    () =>
      buildDraft({
        pageBg: dsb$.original.pageBg,
        pageBgDark: dsb$.original.pageBgDark,
        pageCustomBg: dsb$.original.pageCustomBg,
        pageCustomBgDark: dsb$.original.pageCustomBgDark,
        pageCustomIntensity: dsb$.original.pageCustomIntensity,
        pageCustomIntensityDark: dsb$.original.pageCustomIntensityDark,
      }),
    [
      dsb$.original.pageBg,
      dsb$.original.pageBgDark,
      dsb$.original.pageCustomBg,
      dsb$.original.pageCustomBgDark,
      dsb$.original.pageCustomIntensity,
      dsb$.original.pageCustomIntensityDark,
    ],
  )

  const [draft, setDraft] = useState(storeDraft)

  useEffect(() => {
    setDraft(storeDraft)
  }, [storeDraft])

  const rawBg = useMemo(() => resolveRawBg(draft, isLightTheme), [draft, isLightTheme])
  const background = useMemo(() => {
    if (!rawBg) return null
    return blurRGB(rawBg, gaussBlur)
  }, [gaussBlur, rawBg])

  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return

    if (background) {
      ;(main as HTMLElement).style.backgroundColor = background
      return
    }

    ;(main as HTMLElement).style.removeProperty('background-color')
  }, [background])

  useEffect(() => {
    return () => {
      const main = document.querySelector('main')
      if (!main) return
      ;(main as HTMLElement).style.removeProperty('background-color')
    }
  }, [])

  const onDraftChange = (patch: Partial<TPageBgDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  const activeTouched =
    draft.pageBg !== originalDraft.pageBg ||
    draft.pageCustomBg !== originalDraft.pageCustomBg ||
    draft.pageCustomIntensity !== originalDraft.pageCustomIntensity ||
    draft.pageBgDark !== originalDraft.pageBgDark ||
    draft.pageCustomBgDark !== originalDraft.pageCustomBgDark ||
    draft.pageCustomIntensityDark !== originalDraft.pageCustomIntensityDark

  const handleCancel = () => {
    setDraft(originalDraft)
  }

  const handleConfirm = () => {
    dsb$.live$.commit({
      pageBg: draft.pageBg,
      pageBgDark: draft.pageBgDark,
      pageCustomBg: draft.pageCustomBg,
      pageCustomBgDark: draft.pageCustomBgDark,
      pageCustomIntensity: draft.pageCustomIntensity,
      pageCustomIntensityDark: draft.pageCustomIntensityDark,
    })

    window.requestAnimationFrame(() => {
      onSave(isLightTheme ? FIELD.PAGE_BG : FIELD.PAGE_BG_DARK)
    })
  }

  return (
    <section className={s.wrapper}>
      <SectionLabel
        title={t('dsb.layout.page_background.title')}
        desc={t('dsb.layout.page_background.desc')}
        withThemeSelect
      />

      <div className={s.themeGroup}>
        {mounted &&
          s.bgColorNames.map((bg, index) => {
            const bgTitle = titleCaseHM(bg)
            const pageName = camelize(bg)
            const bgVal = PAGE_BG_COLOR_HEX[bg]
            const active = rawBg === bgVal && !!rawBg

            return (
              <button
                key={bg}
                type='button'
                className={cn(s.block, `rotate-${s.rotateAngle[index]}`, active && s.blockActive)}
                aria-pressed={active}
                onClick={() => {
                  onDraftChange(
                    isLightTheme
                      ? { pageBg: bg }
                      : {
                          pageBgDark: bg,
                        },
                  )
                }}
              >
                <div className={cn(s.blockInner, s.getPageClass(pageName))}>
                  {active && <CheckSVG className={s.checker} />}
                </div>
                <div className={s.footer}>
                  <div className={s.colorTitle}>{bgTitle}</div>
                  <div className={s.hex}>{bgVal}</div>
                </div>
              </button>
            )
          })}
      </div>

      <CustomBackground draft={draft} originalDraft={originalDraft} onDraftChange={onDraftChange} />

      <SavingBar
        isTouched={activeTouched}
        loading={dsb$.saving}
        top={10}
        left={1}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
    </section>
  )
}
