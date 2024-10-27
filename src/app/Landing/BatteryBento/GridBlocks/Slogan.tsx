import PlugSVG from '~/icons/Plug'
import PointSVG from '~/icons/PointDuo'

import useSalon from '../../salon/battery_bento/grid_blocks/slogan'

export default () => {
  const s = useSalon()

  return (
    <>
      <div className={s.topping}>
        <PlugSVG className={s.plugIcon} />
        Bizz~
      </div>
      <div className={s.main}>
        除此之外，我们深知这些细节也至关重要，所以还内置了 <PointSVG className={s.pointIcon} />
      </div>
    </>
  )
}
