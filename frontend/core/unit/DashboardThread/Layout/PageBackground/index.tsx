import { useCallback, useEffect, useMemo, useRef } from 'react'

import { PAGE_BG_COLOR_HEX } from '~/const/colors'
import { blurRGB, camelize, titleCaseHM } from '~/fmt'
import useDidMount from '~/hooks/useDidMount'
import useGaussBlur from '~/hooks/useGaussBlur'
import useLocalDraft from '~/hooks/useLocalDraft'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import useUpdatePreviewCssVars from '~/hooks/useUpdatePreviewCssVars'
import CheckSVG from '~/icons/Check'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../../constant'
import useHelper from '../../logic/useHelper'
import useSalon, { cn } from '../../salon/layout/page_background'
import { getRotateClass } from '../../salon/layout/rotate'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import CustomBackground from './CustomBackground'
import { resolveRawBg, type TPageBgDraft, usePageBgDraft } from './hooks'

export default function PageBackground() {
  const dsb$ = useDashboard()
  const { onSave } = useHelper()
  const mounted = useDidMount()
  const s = useSalon()
  const { isLightTheme } = useTheme()
  const { t } = useTrans()
  const gaussBlur = useGaussBlur()
  const updatePreviewCssVars = useUpdatePreviewCssVars()
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const storeDraft = usePageBgDraft(dsb$)
  const originalDraft = usePageBgDraft(dsb$.original)

  const {
    draft,
    setDraft,
    isTouched: activeTouched,
    resetDraft,
  } = useLocalDraft(storeDraft, originalDraft)

  const rawBg = useMemo(() => resolveRawBg(draft, isLightTheme), [draft, isLightTheme])
  const background = useMemo(() => {
    if (!rawBg) return null
    return blurRGB(rawBg, gaussBlur)
  }, [gaussBlur, rawBg])

  useEffect(() => {
    updatePreviewCssVars({ '--preview-page-bg': background })
  }, [background, updatePreviewCssVars])

  const previewPageBg = useCallback(
    (patch: Partial<TPageBgDraft>) => {
      const previewRawBg = resolveRawBg({ ...draft, ...patch }, isLightTheme)
      const previewBackground = previewRawBg ? blurRGB(previewRawBg, gaussBlur) : null

      updatePreviewCssVars({ '--preview-page-bg': previewBackground })
    },
    [draft, gaussBlur, isLightTheme, updatePreviewCssVars],
  )

  const onDraftChange = (patch: Partial<TPageBgDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  const commitPageBgDraft = useCallback((patch: Partial<TPageBgDraft>) => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current)
    }

    commitTimerRef.current = setTimeout(() => {
      onDraftChange(patch)
    }, 300)
  }, [])

  useEffect(() => {
    return () => {
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current)
      }
    }
  }, [])

  const handleConfirm = () => {
    dsb$.live$.editFields({
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
                className={cn(
                  s.block,
                  getRotateClass(s.rotateAngle[index]),
                  active && s.blockActive,
                )}
                aria-pressed={active}
                onClick={() => {
                  const pageBgKey = isLightTheme ? FIELD.PAGE_BG : FIELD.PAGE_BG_DARK
                  onDraftChange({ [pageBgKey]: bg })
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

      <CustomBackground
        draft={draft}
        originalDraft={originalDraft}
        onDraftChange={onDraftChange}
        onPreviewPatch={previewPageBg}
        onScheduleCommitPatch={commitPageBgDraft}
      />

      <SavingBar
        isTouched={activeTouched}
        top={10}
        left={1}
        onCancel={resetDraft}
        onConfirm={handleConfirm}
      />
    </section>
  )
}
