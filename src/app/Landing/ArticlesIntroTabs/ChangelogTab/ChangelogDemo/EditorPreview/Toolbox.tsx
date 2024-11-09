import RotateSVG from '~/icons/Rotate'
import ArchSVG from '~/icons/Arch'
import ShadowSVG from '~/icons/Shadow'
import BlocksSVG from '~/icons/Blocks'
import LightSVG from '~/icons/FlashLight'
import RatioSVG from '~/icons/Ratio'
import SizeSVG from '~/icons/ImageSize'

import useSalon from '../../../../salon/articles_intro_tabs/changelog_tab/changelog_demo/editor_preview/toolbox'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.item}>
        <RotateSVG className={s.icon} />
        <div className={s.title}>旋转</div>
      </div>
      <div className={s.item}>
        <ArchSVG className={s.icon} />
        <div className={s.title}>弧度</div>
      </div>
      <div className={s.item}>
        <ShadowSVG className={s.icon} />
        <div className={s.title}>阴影</div>
      </div>
      <div className={s.item}>
        <BlocksSVG className={s.icon} />
        <div className={s.title}>位置</div>
      </div>
      <div className={s.item}>
        <SizeSVG className={s.icon} />
        <div className={s.title}>大小</div>
      </div>
      <div className={s.item}>
        <LightSVG className={s.icon} />
        <div className={s.title}>灯光</div>
      </div>
      <div className={s.item}>
        <RatioSVG className={s.icon} />
        <div className={s.title}>比例</div>
      </div>
      <div className={s.item}>
        <div className={s.colorBall} />
        <div className={s.title}>背景</div>
      </div>
    </div>
  )
}
