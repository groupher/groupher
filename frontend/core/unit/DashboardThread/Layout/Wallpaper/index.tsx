import { PAGE_BG_CSS_KEY } from '~/const/colors'
import { blurRGB } from '~/fmt'
import useCSSVar from '~/hooks/useCssVar'
import useGaussBlur from '~/hooks/useGaussBlur'
import useTrans from '~/hooks/useTrans'
import useWallpaper from '~/hooks/useWallpaper'
import SettingSVG from '~/icons/Setting'
import { callWallpaperEditor } from '~/signal'
import CheckLabel from '~/widgets/CheckLabel'

import SectionLabel from '../../SectionLabel'

import useSalon, { cn, cnMerge } from '../../salon/layout/wallpaper'

export default function Wallpaper() {
  const s = useSalon()
  const { t } = useTrans()

  const gaussBlur = useGaussBlur()
  const { background } = useWallpaper()
  const pageBg = useCSSVar(PAGE_BG_CSS_KEY, [gaussBlur], { selector: 'main' })

  const bgColor = `${blurRGB(pageBg, gaussBlur)}`

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.layout.wallpaper.title')}
        desc={t('dsb.layout.wallpaper.desc')}
        width='96%'
      />

      <div className={s.preview}>
        <button type='button' className={s.hoverMask} onClick={() => callWallpaperEditor()}>
          <SettingSVG className={s.settingIcon} />
          <div className={cn(s.previewImage, 'group-hover:brightness-90')} style={{ background }} />
          <CheckLabel title={t('dsb.layout.wallpaper.original')} top={4} active={false} />
        </button>
        <div className={s.previewer}>
          <div className={s.realPreview}>
            <div className={s.previewImage} style={{ background }} />
            <div className={s.content} style={{ background: bgColor }}>
              <div className={s.contentTop}>
                <div className={cnMerge(s.bar, s.titleBar)} />
                <div className={cnMerge(s.bar, s.wideBar)} />
                <div className={cnMerge(s.bar, s.midBar)} />
                <div className={cnMerge(s.bar, s.longBar)} />
                <div className={cnMerge(s.bar, s.shortBar)} />
                <div className={cnMerge(s.bar, s.dimBar)} />
              </div>
              <div className={s.contentBottom}>
                <div className={cnMerge(s.bar, s.footerShort)} />
                <div className={cnMerge(s.bar, s.footerWide)} />
              </div>
            </div>
          </div>
          <CheckLabel title={t('dsb.layout.wallpaper.preview')} top={4} active={false} />
        </div>
      </div>
    </div>
  )
}
