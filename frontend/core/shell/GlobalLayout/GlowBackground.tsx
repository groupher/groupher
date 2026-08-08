import METRIC from '~/const/metric'
import useMetric from '~/hooks/useMetric'
import useTopGlow from '~/hooks/useTopGlow'

import useSalon from './salon/glow_background'

export default function GlowBackground() {
  const s = useSalon()
  const metric = useMetric()
  const { glowType } = useTopGlow()

  if (metric === METRIC.LANDING) return null

  if (!glowType) return null

  const style = {
    background: `${s.bgStyle}`,
    opacity: `var(--preview-glow-opacity, ${s.opacity})`,
  }

  return <div className={s.wrapper} style={style} />
}
