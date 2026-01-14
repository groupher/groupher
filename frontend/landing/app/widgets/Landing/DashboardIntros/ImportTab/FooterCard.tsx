import Img from '~/Img'

import useSalon, { cn } from '../../salon/dashboard_intros/import_tab/footer_card'

export default function FooterCard() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={cn(s.imcard, '-rotate-3')}>
        <Img src='landing/products/dingding.png' className={s.img} />
        <Img src='landing/products/feishu.png' className={s.img} />
        <Img src='landing/seo/wechat2.png' className={s.img} />
        <Img src='landing/products/slack.png' className={s.img} />
        <Img src='landing/products/discord.png' className={s.img} />
      </div>
      <div className={cn(s.imcard, s.otherCard, 'rotate-3')}>
        <Img src='landing/products/email.png' className={s.img} />
        <Img src='landing/seo/rss.png' className={s.img} />
        <Img src='landing/products/webhook.png' className={cn(s.img, 'size-6')} />
      </div>
    </div>
  )
}
