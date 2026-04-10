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

import useSalon, { cnMerge } from '../../salon/layout/gauss_blur'

export default function Light() {
  const s = useSalon()
  const { t } = useTrans()

  const { wallpaper, background } = useWallpaper()
  const { gaussBlur, saving, isTouched, edit } = useGaussBlur()

  const pageBg = useCSSVar(PAGE_BG_CSS_KEY)
  const bgColor = `${blurRGB(pageBg, gaussBlur)}`

  return (
    <div className={s.wrapper} key={wallpaper}>
      <SectionLabel
        title={t('dsb.layout.gauss_blur.title')}
        desc={t('dsb.layout.gauss_blur.desc')}
        classNames='pr-8'
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
            onChange={(v) => edit(v, FIELD.GAUSS_BLUR)}
            top={5}
            min={50}
            max={100}
            unit='%'
          />
        </ul>
      </div>

      <SavingBar isTouched={isTouched} field={FIELD.GAUSS_BLUR} loading={saving} top={10} />
    </div>
  )
}
