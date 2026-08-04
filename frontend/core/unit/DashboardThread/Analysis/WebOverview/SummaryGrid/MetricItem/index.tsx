import useTrans from '~/hooks/useTrans'

import useSalon from './salon'
import type { TSummaryMetricItem } from '../../spec'

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
