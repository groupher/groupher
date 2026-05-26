import { PAGE_BG_CSS_KEY } from '~/const/colors'
import { blurRGB } from '~/fmt'
import useCSSVar from '~/hooks/useCssVar'
import useGaussBlur from '~/hooks/useGaussBlur'
import useWallpaper from '~/hooks/useWallpaper'

import SavingBar from '../../SavingBar'
import EffectsPanel from './EffectsPanel'
import useSalon, { cnMerge } from './salon/preview_card'
import useLogic from './useLogic'

export default function PreviewCard() {
  const s = useSalon()
  const { isTouched, loading, rollbackWallpaper, onSave } = useLogic()

  const gaussBlur = useGaussBlur()
  const { background } = useWallpaper()
  const pageBg = useCSSVar(PAGE_BG_CSS_KEY, [gaussBlur], { selector: 'main' })

  const bgColor = `${blurRGB(pageBg, gaussBlur)}`

  return (
    <>
      <div className={s.previewCard}>
        <div className={s.previewLayout}>
          <div className={s.previewPanel}>
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
          </div>

          <div className={s.customizePanel}>
            <EffectsPanel />
          </div>
        </div>
      </div>

      <SavingBar
        isTouched={isTouched}
        loading={loading}
        onCancel={rollbackWallpaper}
        onConfirm={onSave}
        top={6}
      />
    </>
  )
}
