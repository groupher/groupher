import useTrans from '~/hooks/useTrans'
import useSalon from '../../salon/articles_intro_tabs/help_tab/intro_digest'
import IntroItems from './IntroItems'

export default function IntroDigest() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>{t('landing.articles.help.title')}</div>
      <div className={s.digest}>
        {t('landing.articles.help.digest.prefix')}
        <span className={s.highlight}>{t('landing.articles.help.digest.faq')}</span>，
        <span className={s.highlight}>{t('landing.articles.help.digest.kb')}</span>
        {t('landing.articles.help.digest.suffix')}
      </div>

      <IntroItems />
    </div>
  )
}
