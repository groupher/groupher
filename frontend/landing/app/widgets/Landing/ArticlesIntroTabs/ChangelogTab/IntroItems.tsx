import { COLOR } from '~/const/colors'
import useTrans from '~/hooks/useTrans'
import ArrowLinker from '~/widgets/ArrowLinker'
import Button from '~/widgets/Buttons/Button'

import useSalon, { cn } from '../../salon/articles_intro_tabs'
import FeatItem from '../FeatItem'

const color = COLOR.RED

export default function IntroItems() {
  const s = useSalon()
  const { t } = useTrans()
  const itemKeys = [
    'landing.articles.changelog.feature.0',
    'landing.articles.changelog.feature.1',
    'landing.articles.changelog.feature.2',
    'landing.articles.changelog.feature.3',
    'landing.articles.changelog.feature.4',
    'landing.articles.changelog.feature.5',
  ] as const

  return (
    <>
      <div className={s.featList}>
        {itemKeys.map((key) => (
          <FeatItem key={key} text={t(key)} color={color} />
        ))}
      </div>

      <div className='grow' />
      <div className={cn(s.footer, 'mt-16')}>
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
