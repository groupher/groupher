import Link from 'next/link'

import METRIC from '~/const/metric'
import useMetric from '~/hooks/useMetric'

import useSalon from './salon/powerby_info'

export default function PowerbyInfo() {
  const s = useSalon()
  const metric = useMetric()

  return (
    <div className={s.wrapper}>
      {metric !== METRIC.LANDING && (
        <div className={s.note}>
          由
          <Link className={s.link} href='/'>
            Groupher
          </Link>
          提供服务
        </div>
      )}

      <div className={s.bottom}>
        {metric === METRIC.LANDING && <div className={s.note}>Made in ChengDu</div>}
        {metric === METRIC.LANDING && <div className={s.lineDivider} />}
        <div className={s.note}>违法信息举报</div>
      </div>
    </div>
  )
}
