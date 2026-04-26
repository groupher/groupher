import { COLOR } from '~/const/colors'
import useTrans from '~/hooks/useTrans'
import ArrowLinker from '~/widgets/ArrowLinker'
import Button from '~/widgets/Buttons/Button'

import useSalon from '../../salon/articles_intro_tabs'
import FeatItem from '../FeatItem'

const color = COLOR.PURPLE

export default function IntroItems() {
  const s = useSalon()
  const { t } = useTrans()
  const itemKeys = [
    'landing.articles.discuss.feature.0',
    'landing.articles.discuss.feature.1',
    'landing.articles.discuss.feature.2',
    'landing.articles.discuss.feature.3',
    'landing.articles.discuss.feature.4',
    'landing.articles.discuss.feature.5',
  ] as const

  return (
    <>
      <div className={s.featList}>
        {itemKeys.map((key) => (
          <FeatItem key={key} text={t(key)} color={color} />
        ))}
      </div>

      <div className='grow' />
      <div className={s.footer}>
        <Button color={color} ghost>
          {t('landing.articles.common.example')}
        </Button>

        <ArrowLinker href='/' color={color} className='py-2'>
          {t('landing.articles.common.more')}
        </ArrowLinker>
      </div>
    </>
  )
}
