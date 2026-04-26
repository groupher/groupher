import useTrans from '~/hooks/useTrans'

import useSalon from '../../salon/articles_intro_tabs/discuss_tab/intro_digest'
import IntroItems from './IntroItems'

export default function IntroDigest() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>{t('landing.articles.discuss.title')}</div>
      <div className={s.digest}>
        {t('landing.articles.discuss.digest.prefix')}
        <span className={s.highlight}>{t('landing.articles.discuss.digest.team')}</span>
        {t('landing.articles.discuss.digest.sep')}
        <span className={s.highlight}>{t('landing.articles.discuss.digest.users')}</span>
        {t('landing.articles.discuss.digest.suffix')}
      </div>

      <IntroItems />
    </div>
  )
}
