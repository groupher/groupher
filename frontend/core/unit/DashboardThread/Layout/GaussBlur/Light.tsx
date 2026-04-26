import { blurRGB } from '~/fmt'
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
import useSalon, { cnMerge } from '../../salon/layout/gauss_blur'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'

export default function Light() {
  const s = useSalon()
  const { t } = useTrans()
  const dsb$ = useDashboard()
  const { onSave } = useHelper()
  const { isLightTheme } = useTheme()

  const { wallpaper, background } = useWallpaper()
  const { rawBg } = usePageBg()
  const { draft: gaussBlur, setDraft, isTouched, resetDraft } = useLocalDraft(FIELD.GAUSS_BLUR)

  const bgColor = `${blurRGB(rawBg, gaussBlur)}`
  const cleanupBackground = blurRGB(rawBg, dsb$.gaussBlur)

  useMainBackgroundPreview(bgColor, { enabled: isLightTheme, cleanupBackground })

  return (
    <div className={s.wrapper} key={wallpaper}>
      <SectionLabel
        title={t('dsb.layout.gauss_blur.title')}
        desc={t('dsb.layout.gauss_blur.desc')}
        withThemeSelect
      />

      <div className={s.content}>
        <div className={s.previewer}>
          <div className={s.previewImage} style={{ background }} />
          <div className={s.contentBlock} style={{ background: bgColor }}>
            <div className={s.contentTop}>
              <div className={cnMerge(s.bar, s.titleBar)} />
              <div className={cnMerge(s.bar, s.wideBar)} />
              <div className={cnMerge(s.bar, s.midBar)} />
              <div className={cnMerge(s.bar, s.longBar)} />
              <div className={cnMerge(s.bar, s.shortBar)} />
              <div className={cnMerge(s.bar, s.dimBar)} />
            </div>

            <div className={s.contentBottom}>
              <div className={cnMerge(s.bar, s.footerMid)} />
              <div className={cnMerge(s.bar, s.footerLong)} />
              <div className={cnMerge(s.bar, s.footerBottomMid)} />
              <div className={cnMerge(s.bar, s.footerBottomLong)} />
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
            value={gaussBlur}
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
        top={10}
        onCancel={resetDraft}
        onConfirm={() => {
          dsb$.live$.commit({ gaussBlur: gaussBlur })
          window.requestAnimationFrame(() => onSave(FIELD.GAUSS_BLUR))
        }}
      />
    </div>
  )
}
