/*
 *
 * ColorSelector
 *
 */

import HookSVG from '~/icons/Hook'
import useSalon from './salon/custom_color'

type TProps = {
  color: string
}

const CustomColor = ({ color }: TProps) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.divider} />
      <button className={s.inner}>
        <div className={s.dot}>
          <div className={s.dotInner} style={{ backgroundColor: color }}>
            <HookSVG className={s.checkIcon} />
          </div>
        </div>
      </button>

      <div className={s.title}>自定义颜色</div>
    </div>
  )
}

export default CustomColor
