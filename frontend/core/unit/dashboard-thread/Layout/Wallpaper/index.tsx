import { PAGE_BG_CSS_KEY } from '~/const/colors'
import { blurRGB } from '~/fmt'
import useCSSVar from '~/hooks/useCssVar'
import useGaussBlur from '~/hooks/useGaussBlur'
import useWallpaper from '~/hooks/useWallpaper'
import useTrans from '~/hooks/useTrans'
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
  const pageBg = useCSSVar(PAGE_BG_CSS_KEY)

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
              <div className={cnMerge(s.bar, 'top-3 opacity-30')} />
              <div className={cnMerge(s.bar, 'top-8 w-40 opacity-20')} />

              <div className={cnMerge(s.bar, 'top-14 w-32 opacity-30')} />
              <div className={cnMerge(s.bar, 'top-20 w-44 -mt-1.5 opacity-20')} />

              <div className={cnMerge(s.bar, 'top-24 w-20 opacity-20')} />
              <div className={cnMerge(s.bar, 'top-28 w-32 mt-0.5 opacity-10')} />

              <div className={cnMerge(s.bar, 'bottom-8 w-14 opacity-15')} />
              <div className={cnMerge(s.bar, 'bottom-4 w-32 mt-0.5 opacity-10')} />
            </div>
          </div>
          <CheckLabel title={t('dsb.layout.wallpaper.preview')} top={4} active={false} />
        </div>
      </div>
    </div>
  )
}
