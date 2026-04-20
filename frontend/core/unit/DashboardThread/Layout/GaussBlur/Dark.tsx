import { blurRGB } from '~/fmt'
import THEME from '~/const/theme'
import useLocalDraft from '~/hooks/useLocalDraft'
import useMainBackgroundPreview from '~/hooks/useMainBackgroundPreview'
import usePageBg from '~/hooks/usePageBg'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import useWallpaper from '~/hooks/useWallpaper'
import useDashboard from '~/stores/dashboard/hooks'
import RangeSlider from '~/widgets/RangeSlider'

import { FIELD } from '../../constant'
import useHelper from '../../logic/useHelper'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'

import useSalon, { cn } from '../../salon/layout/gauss_blur'

export default function Dark() {
  const s = useSalon()
  const { t } = useTrans()
  const dsb$ = useDashboard()
  const { onSave } = useHelper()
  const { isDarkTheme } = useTheme()

  const { wallpaper, background } = useWallpaper()
  const { rawBg } = usePageBg(THEME.DARK)
  const {
    draft: gaussBlurDark,
    setDraft,
    isTouched,
    resetDraft,
  } = useLocalDraft(FIELD.GAUSS_BLUR_DARK)

  const bgColor = `${blurRGB(rawBg, gaussBlurDark)}`
  const cleanupBackground = blurRGB(rawBg, dsb$.gaussBlurDark)

  useMainBackgroundPreview(bgColor, { enabled: isDarkTheme, cleanupBackground })

  return (
    <div className={s.wrapper} key={wallpaper}>
      <SectionLabel
        title={t('dsb.layout.gauss_blur.title_dark')}
        desc={t('dsb.layout.gauss_blur.desc')}
        withThemeSelect
      />

      <div className={s.content}>
        <div className={s.previewer}>
          <div className={s.previewImage} style={{ background }} />
          <div className={s.contentBlock} style={{ background: bgColor }}>
            <div className={s.contentTop}>
              <div className={cn(s.bar, s.titleBar)} />
              <div className={cn(s.bar, s.wideBar)} />
              <div className={cn(s.bar, s.midBar)} />
              <div className={cn(s.bar, s.longBar)} />
              <div className={cn(s.bar, s.shortBar)} />
              <div className={cn(s.bar, s.dimBar)} />
            </div>

            <div className={s.contentBottom}>
              <div className={cn(s.bar, s.footerMid)} />
              <div className={cn(s.bar, s.footerLong)} />
              <div className={cn(s.bar, s.footerBottomMid)} />
              <div className={cn(s.bar, s.footerBottomLong)} />
            </div>
          </div>
        </div>
        <ul className={s.actions}>
          <h3 className={s.title}>{t('dsb.layout.gauss_blur.opacity.title')}</h3>
          <li className={s.desc}>{t('dsb.layout.gauss_blur.opacity.note.default')}</li>
          <li className={s.desc}>{t('dsb.layout.gauss_blur.opacity.note.low')}</li>
          <li className={s.desc}>{t('dsb.layout.gauss_blur.opacity.note.unsupported')}</li>
          <li className={s.desc}>
            {t('dsb.layout.gauss_blur.opacity.note.prefix')}
            <span className={s.highlight}>{t('dsb.layout.gauss_blur.opacity.note.light')}</span>/
            <span className={s.highlight}>{t('dsb.layout.gauss_blur.opacity.note.dark')}</span>
            {t('dsb.layout.gauss_blur.opacity.note.suffix')}
          </li>

          <br />
          <RangeSlider
            value={gaussBlurDark}
            onChange={(v) => setDraft(v)}
            top={5}
            min={50}
            max={100}
            step={0.1}
            unit='%'
          />
        </ul>
      </div>

      <SavingBar
        isTouched={isTouched}
        top={20}
        onCancel={resetDraft}
        onConfirm={() => {
          dsb$.live$.commit({ gaussBlurDark: gaussBlurDark })
          window.requestAnimationFrame(() => onSave(FIELD.GAUSS_BLUR_DARK))
        }}
      />
    </div>
  )
}
