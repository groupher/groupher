import useTrans from '~/hooks/useTrans'

import type { TSummaryMetricItem } from '../../spec'
import useSalon from './salon'

type TProps = {
  item: TSummaryMetricItem
}

export default function MetricItem({ item }: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const changeRate = item.changeRate
  const direction =
    changeRate === null ? null : changeRate > 0 ? 'up' : changeRate < 0 ? 'down' : 'flat'
  const isPositive =
    direction === 'flat' || (item.key === 'bounceRate' ? direction === 'down' : direction === 'up')

  return (
    <div className={s.wrapper}>
      <div className={s.label}>{t(item.label)}</div>
      <div className={s.value}>{item.value}</div>
      {changeRate !== null ? (
        <div className={s.change}>
          <span className={isPositive ? s.positiveChange : s.negativeChange}>
            {direction === 'up' ? '↑' : direction === 'down' ? '↓' : '–'} {Math.abs(changeRate)}%
          </span>
          <span className={s.comparison}>{t('dsb.analysis.vs_last_7_days')}</span>
        </div>
      ) : null}
    </div>
  )
}
