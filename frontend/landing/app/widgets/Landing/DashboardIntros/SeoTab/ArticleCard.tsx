import APP from '~/const/app'
import Img from '~/Img'

import useSalon from '../../salon/dashboard_intros/seo_tab/article_card'

export default function ArticleCard() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <Img src={`/${APP.LANDING}/seo/wechat.png`} className={s.brand} />
        <Img src={`/${APP.LANDING}/seo/zhihu.png`} className={s.brand} />
        <Img src={`/${APP.LANDING}/seo/xhs.png`} className={s.brand} />
        <Img src={`/${APP.LANDING}/seo/medium.png`} className={s.brand} />
        <Img src={`/${APP.LANDING}/seo/discord.png`} className={s.brand} />
        <Img src={`/${APP.LANDING}/seo/tg.png`} className={s.brand} />
        <div className='grow' />
      </div>
      <div className={s.title}>Motojie - (摩界)</div>
      <div className={s.desc}>发现复古摩托车的魅力。我们专注于提供全球最独特...</div>
      <div className={s.url}>https://motojie.com</div>
    </div>
  )
}
