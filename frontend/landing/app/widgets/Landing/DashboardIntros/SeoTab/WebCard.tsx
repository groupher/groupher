import APP from '~/const/app'
import Img from '~/Img'
import useSalon from '../../salon/dashboard_intros/seo_tab/web_card'

export default function WebCard() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.url}>https://motojie.com</div>
      <div className={s.title}>Motojie - (摩界)</div>
      <div className={s.desc}>
        发现复古摩托车的魅力。我们专注于提供全球最独特、最经典的复古摩托车信息。愿每一位对复古摩托车有热情的人...
      </div>

      <div className={s.footer}>
        <div className={s.logoBox}>
          <Img src={`/${APP.LANDING}/seo/google.png`} className={s.logo} />
        </div>
        <div className={s.logoBox}>
          <Img src={`/${APP.LANDING}/seo/baidu.png`} className={s.logo} />
        </div>
        <div className={s.logoBox}>
          <Img src={`/${APP.LANDING}/seo/ms.png`} className={s.logo} />
        </div>

        <div className={s.logoBox}>
          <Img src={`/${APP.LANDING}/seo/duck.png`} className={s.logo} />
        </div>
        <div className='grow' />

        <div className={s.hint}>OpenGraph</div>
      </div>
    </div>
  )
}
