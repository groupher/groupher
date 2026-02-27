import METRIC from '~/const/metric'
import useGlowLight from '~/hooks/useGlowLight'
import useMetric from '~/hooks/useMetric'
import useSalon from './salon/glow_background'

export default () => {
  const s = useSalon()
  const metric = useMetric()
  const { glowType } = useGlowLight()

  if (metric === METRIC.LANDING) return null

  if (!glowType) return null

  const style = { background: `${s.bgStyle}` }

  return <div className={s.wrapper} style={style} />
}
