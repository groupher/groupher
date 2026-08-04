import useTrans from '~/hooks/useTrans'

import type { TSummaryMetricItem } from '../../spec'
import useSalon from './salon'

type TProps = {
  item: TSummaryMetricItem
}

export default function MetricItem({ item }: TProps) {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.label}>{t(item.label)}</div>
      <div className={s.value}>{item.value}</div>
    </div>
  )
}
