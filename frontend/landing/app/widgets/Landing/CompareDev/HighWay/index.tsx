import SeedSVG from '~/icons/Seed'
import useSalon, { cn } from '../../salon/compare_dev/high_way'
import Block from './Block'

export default function HighWay() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <SeedSVG className={cn(s.seedIcon, 'top-14 -left-6')} />
      <div className={s.dashline} />
      <Block text='开发' noDot />
      <div className={s.connectline} />
      <Block text='开发' />
      <div className={s.connectline} />
      <Block text='开发' />
      <div className={s.connectline} />
      <Block text='上线没人用' type='online' />
      <div className={s.connectline} />
      <Block text='扑街' type='giveup' />
    </div>
  )
}
