import { COLOR } from '~/const/colors'
import useTrans from '~/hooks/useTrans'
import ArrowLinker from '~/widgets/ArrowLinker'
import Button from '~/widgets/Buttons/Button'

import useSalon, { cn } from '../../salon/articles_intro_tabs'
import FeatItem from '../FeatItem'

const color = COLOR.CYAN
export default function IntroItems() {
  const s = useSalon()
  const { t } = useTrans()
  const itemKeys = [
    'landing.articles.help.feature.0',
    'landing.articles.help.feature.1',
    'landing.articles.help.feature.2',
    'landing.articles.help.feature.3',
    'landing.articles.help.feature.4',
    'landing.articles.help.feature.5',
    'landing.articles.help.feature.6',
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
