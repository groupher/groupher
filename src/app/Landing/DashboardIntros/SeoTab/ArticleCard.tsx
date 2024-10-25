import Img from '~/Img'

import useSalon from '../../styles/dashboard_intros/seo_tab/article_card'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <Img src="/landing/seo/wechat.png" className={s.brand} />
        <Img src="/landing/seo/zhihu.png" className={s.brand} />
        <Img src="/landing/seo/xhs.png" className={s.brand} />
        <Img src="/landing/seo/medium.png" className={s.brand} />
        <Img src="/landing/seo/discord.png" className={s.brand} />
        <Img src="/landing/seo/tg.png" className={s.brand} />
        <div className="grow" />
      </div>
      <div className={s.title}>Motojie - (摩界)</div>
      <div className={s.desc}>发现复古摩托车的魅力。我们专注于提供全球最独特...</div>
      <div className={s.url}>https://motojie.com</div>
    </div>
  )
}
