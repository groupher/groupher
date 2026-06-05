import { GRADIENT_DIRECTION } from '~/const/wallpaper'
import ArrowSVG from '~/icons/Arrow'
import type { TWallpaperGradientDir } from '~/spec'

import useLogic from '../../../../useLogic'
import GroupItem from '../../GroupItem'
import useSalon, { cn } from './salon'

type TProps = {
  direction: TWallpaperGradientDir
}

export default function Direction({ direction }: TProps) {
  const s = useSalon()
  const { gradientDirOnChange } = useLogic()

  return (
    <GroupItem label='Direction'>
      <div className={s.dirRow}>
        {Object.values(GRADIENT_DIRECTION).map((dir) => (
          <button
            key={dir}
            type='button'
            className={cn(s.imageItem, s.dirItem, dir === direction && s.imageItemActive)}
            onClick={() => gradientDirOnChange(dir)}
          >
            <ArrowSVG
              className={s.dirArrow}
              style={{ transform: `rotate(${s.getBgGradientDirAngle(dir)})` }}
            />
          </button>
        ))}
      </div>
    </GroupItem>
  )
}
