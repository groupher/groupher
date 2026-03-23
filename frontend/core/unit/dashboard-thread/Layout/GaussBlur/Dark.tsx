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
            <div className={cn(s.bar)} />
            <div className={cn(s.bar, 'top-10 w-40 opacity-20')} />

            <div className={cn(s.bar, 'top-16 w-28')} />
            <div className={cn(s.bar, 'top-20 w-44 opacity-20')} />

            <div className={cn(s.bar, 'top-24 w-16 opacity-30 mt-2')} />
            <div className={cn(s.bar, 'top-28 w-32 opacity-15 mt-2')} />

            <div className={cn(s.bar, 'bottom-20 w-28 opacity-30')} />
            <div className={cn(s.bar, 'bottom-16 w-44 opacity-15')} />

            <div className={cn(s.bar, 'bottom-8 w-28 opacity-20')} />
            <div className={cn(s.bar, 'bottom-4 w-44 opacity-10')} />
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
