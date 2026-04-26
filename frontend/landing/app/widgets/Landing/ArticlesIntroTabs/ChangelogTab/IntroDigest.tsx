import useTrans from '~/hooks/useTrans'

import useSalon from '../../salon/articles_intro_tabs/changelog_tab/intro_digest'
import IntroItems from './IntroItems'

export default function IntroDigest() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>{t('landing.articles.changelog.title')}</div>
      <div className={s.digest}>
        {t('landing.articles.changelog.digest.prefix')}
        <span className={s.highlight}>{t('landing.articles.changelog.digest.feature')}</span>
        {t('landing.articles.changelog.digest.sep')}
        <span className={s.highlight}>{t('landing.articles.changelog.digest.bug')}</span>
        {t('landing.articles.changelog.digest.suffix')}
      </div>

      <IntroItems />
    </div>
  )
}
