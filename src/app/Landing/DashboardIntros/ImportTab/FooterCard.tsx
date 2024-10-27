import Img from '~/Img'

import useSalon, { cn } from '../../styles/dashboard_intros/import_tab/footer_card'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.imcard}>
        <Img src="landing/products/dingding.png" className={s.img} />
        <Img src="landing/products/feishu.png" className={s.img} />
        <Img src="landing/seo/wechat2.png" className={s.img} />
        <Img src="landing/products/slack.png" className={s.img} />
        <Img src="landing/products/discord.png" className={s.img} />
      </div>
      <div className={cn(s.imcard, s.otherCard)}>
        <Img src="landing/products/email.png" className={s.img} />
        <Img src="landing/seo/rss.png" className={s.img} />
        <Img src="landing/products/webhook.png" className={cn(s.img, 'size-6')} />
      </div>
    </div>
  )
}
