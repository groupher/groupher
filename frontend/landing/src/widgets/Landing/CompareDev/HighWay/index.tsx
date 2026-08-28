import useTrans from '~/hooks/useTrans'
import SeedSVG from '~/icons/Seed'

import useSalon, { cn } from '../../salon/compare_dev/high_way'
import Block from './Block'

export default function HighWay() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <SeedSVG className={cn(s.seedIcon, 'top-14 -left-6')} />
      <div className={s.dashline} />
      <Block text={t('landing.compare.highway.dev')} noDot />
      <div className={s.connectline} />
      <Block text={t('landing.compare.highway.dev')} />
      <div className={s.connectline} />
      <Block text={t('landing.compare.highway.dev')} />
      <div className={s.connectline} />
      <Block text={t('landing.compare.highway.no_users')} type='online' />
      <div className={s.connectline} />
      <Block text={t('landing.compare.highway.fail')} type='giveup' />
    </div>
  )
}
