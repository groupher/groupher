import WechatSVG from '~/icons/social/WeChat'
import TwitterSVG from '~/icons/TwitterX'

import useSalon from '../../salon/dashboard_intros/links_tab/footer_card'

export default function FooterCard() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.brand}>
        <div className={s.communityLogo} />
        <div className={s.title}>Tiki-taka</div>
        <div className={s.desc}>Visca Barca Visca Catalunya!</div>
        <div className={s.social}>
          <WechatSVG className={s.icon} />
          <TwitterSVG className={s.icon} />
        </div>
      </div>
      <div className={s.links}>
        <div className={s.linkTitle}>核心</div>
        <div className={s.linkName}>梅西</div>
        <div className={s.linkName}>哈维</div>
        <div className={s.linkName}>小白</div>
        <div className={s.linkName}>布教授</div>
      </div>
      <div className={s.links}>
        <div className={s.linkTitle}>荣誉室</div>
        <div className={s.linkName}>西甲</div>
        <div className={s.linkName}>国王杯</div>
        <div className={s.linkName}>欧冠</div>
        <div className={s.linkName}>世俱杯</div>
      </div>
      <div className={s.links}>
        <div className={s.linkTitle}>教练组</div>
        <div className={s.linkName}>瓜帅</div>
        <div className={s.linkName}>克鲁伊夫</div>
      </div>
    </div>
  )
}
