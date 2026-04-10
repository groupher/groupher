import { PAGE_BG_CSS_KEY } from '~/const/colors'
import { blurRGB } from '~/fmt'
import useCSSVar from '~/hooks/useCssVar'
import useTrans from '~/hooks/useTrans'
import useWallpaper from '~/hooks/useWallpaper'
import RangeSlider from '~/widgets/RangeSlider'

import { FIELD } from '../../constant'
import useGaussBlur from '../../logic/useGaussBlur'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'

import useSalon, { cn } from '../../salon/layout/gauss_blur'

export default function Dark() {
  const s = useSalon()
  const { t } = useTrans()

  const { gaussBlurDark, saving, isDarkTouched: isTouched, edit } = useGaussBlur()
  const { wallpaper, background } = useWallpaper()

  const pageBg = useCSSVar(PAGE_BG_CSS_KEY)
  const bgColor = `${blurRGB(pageBg, gaussBlurDark)}`

  return (
    <div className={s.wrapper} key={wallpaper}>
      <SectionLabel
        title={t('dsb.layout.gauss_blur.title_dark')}
        desc={t('dsb.layout.gauss_blur.desc')}
        classNames='pr-8'
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
            onChange={(v) => edit(v, FIELD.GAUSS_BLUR_DARK)}
            top={5}
            min={50}
            max={100}
            unit='%'
          />
        </ul>
      </div>

      <SavingBar isTouched={isTouched} field={FIELD.GAUSS_BLUR_DARK} loading={saving} top={20} />
    </div>
  )
}
