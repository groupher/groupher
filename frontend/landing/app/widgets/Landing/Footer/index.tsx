import { ROUTE } from '~/const/route'
import useTrans from '~/hooks/useTrans'
import Img from '~/Img'
import BorderButton from '~/widgets/Buttons/BorderButton'

import useSalon from '../salon/footer'

export default function Footer() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <Img src='groupher.png' className={s.logo} />

      <h3 className={s.title}>{t('landing.footer.title')}</h3>
      <div className={s.desc}>
        {t('landing.footer.desc.prefix')}
        <span className={s.hightLight}>{t('landing.footer.desc.core')}</span>
        {t('landing.footer.desc.middle')}
        <span className={s.hightLight}>{t('landing.footer.desc.chores')}</span>
        {t('landing.footer.desc.suffix')}
      </div>
      <div className={s.buttons}>
        <a href={ROUTE.APPLY_COMMUNITY} className={s.linkable}>
          <BorderButton space={8}>{t('landing.footer.cta')}</BorderButton>
        </a>
      </div>
    </div>
  )
}
