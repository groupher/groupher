import ClipSVG from '~/icons/Clip'

import OptionArrowSVG from '~/icons/OptionArrow'
import HashTagSVG from '~/icons/HashTag'

import useSalon from '../../salon/dashboard_intros/tags_tab/footer'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <ClipSVG className={s.clipIcon} />
        <div className={s.left}>
          <div className={s.item}>
            <div className={s.label}>标签颜色</div>
            <div className={s.colorDot} />
          </div>
          <div className={s.item}>
            <div className={s.label}>标签样式</div>
            <div className="row-center">
              <HashTagSVG className={s.hashTagIcon} />
              <div className={s.slash}>/</div>
              <div className={s.dotTag} />
            </div>
          </div>
          <div className={s.item}>
            <div className={s.label}>标签名称</div>
            <div className={s.value}>使用分享</div>
          </div>
          <div className={s.item}>
            <div className={s.label}>URL(slug)</div>
            <div className={s.value}>showcase</div>
          </div>
        </div>

        <div className={s.right}>
          <div className={s.item}>
            <div className={s.label}>内容布局</div>
            <div className={s.value}>图文瀑布流</div>
            <OptionArrowSVG className={s.optArrowIcon} />
          </div>
          <div className={s.item}>
            <div className={s.label}>标签简介</div>
            <div className={s.value}>
              这里搜集各位亲们的日常使用分享、实用技巧以及攻略等，Have fun !
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
