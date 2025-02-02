import useGlowLight from '~/hooks/useGlowLight'

import useSalon from './salon/glow_background'

export default () => {
  const s = useSalon()

  const { glowType } = useGlowLight()

  if (!glowType) return null

  const style = { background: `${s.bgStyle}` }

  return <div className={s.wrapper} style={style} />
}
