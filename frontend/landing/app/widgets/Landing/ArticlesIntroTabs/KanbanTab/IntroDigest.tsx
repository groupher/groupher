import { COLOR } from '~/const/colors'
import useTrans from '~/hooks/useTrans'
import useSalon from '../../salon/articles_intro_tabs/kanban_tab/intro_digest'
import FeatItem from '../FeatItem'

const color = COLOR.BLUE

export default function IntroDigest() {
  const s = useSalon()
  const { t } = useTrans()
  const itemKeys = [
    'landing.articles.kanban.feature.0',
    'landing.articles.kanban.feature.1',
    'landing.articles.kanban.feature.2',
    'landing.articles.kanban.feature.3',
    'landing.articles.kanban.feature.4',
    'landing.articles.kanban.feature.5',
  ] as const
  const items = itemKeys.map((key) => t(key))

  return (
    <div className={s.wrapper}>
      <div className={s.digest}>
        {t('landing.articles.kanban.digest.prefix')}
        <span className={s.highlight}>{t('landing.articles.kanban.digest.user')}</span>
        {t('landing.articles.kanban.digest.middle')}
        <span className={s.highlight}>{t('landing.articles.kanban.digest.progress')}</span>
        {t('landing.articles.kanban.digest.and')}
        <span className={s.highlight}>{t('landing.articles.kanban.digest.plan')}</span>
        {t('landing.articles.kanban.digest.suffix')}
      </div>

      <div className={s.features}>
        {items.map((item) => (
          <div key={item} className={s.featItem}>
            <FeatItem text={item} color={color} />
          </div>
        ))}
      </div>
    </div>
  )
}
