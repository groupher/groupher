import useTrans from '~/hooks/useTrans'
import { cn } from '~/lib/css'

import type { TSummaryMetricItem } from '../../spec'
import useSalon from './salon'

type TProps = {
  align: 'start' | 'center' | 'end'
  item: TSummaryMetricItem
}

export default function MetricItem({ align, item }: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const changeRate = item.changeRate
  const direction =
    changeRate === null ? null : changeRate > 0 ? 'up' : changeRate < 0 ? 'down' : 'flat'
  const isPositive =
    direction === 'flat' || (item.key === 'bounceRate' ? direction === 'down' : direction === 'up')

  return (
    <div className={cn(s.wrapper, s.align[align])}>
      <div className={s.label}>{t(item.label)}</div>
      <div className={s.value}>{item.value}</div>
      {changeRate !== null ? (
        <div className={isPositive ? s.positiveChange : s.negativeChange}>
          {direction === 'up' ? '↑' : direction === 'down' ? '↓' : '–'} {Math.abs(changeRate)}%
        </div>
      ) : null}
    </div>
  )
}
