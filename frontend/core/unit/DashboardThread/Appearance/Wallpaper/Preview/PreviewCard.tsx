import { PAGE_BG_CSS_KEY } from '~/const/colors'
import { blurRGB } from '~/fmt'
import useCSSVar from '~/hooks/useCssVar'
import useGaussBlur from '~/hooks/useGaussBlur'
import useWallpaper from '~/hooks/useWallpaper'

import useSalon, { cnMerge } from '../salon/preview/preview_card'

export default function PreviewCard() {
  const s = useSalon()

  const gaussBlur = useGaussBlur()
  const { background } = useWallpaper()
  const pageBg = useCSSVar(PAGE_BG_CSS_KEY, [gaussBlur], { selector: 'main' })

  const bgColor = `${blurRGB(pageBg, gaussBlur)}`

  return (
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
  )
}
