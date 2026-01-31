import { keys } from 'ramda'
import { useState } from 'react'

import Img from '~/Img'
import CircleArrowSVG from '~/icons/ArrowSimple'
import CheckedSVG from '~/icons/CheckBold'
import Button from '~/widgets/Buttons/Button'
import useSalon, { cn } from '../salon/build_in/pictrue_group'
import useLogic from '../useLogic'

export default () => {
  const { getWallpaper, changePatternWallpaper } = useLogic()
  const { wallpaper, patternWallpapers } = getWallpaper()

  const [showMore, setShowMore] = useState(false)

  const s = useSalon({ showMore })

  const _patternKeys = keys(patternWallpapers)
  const patternKeys = showMore ? _patternKeys : _patternKeys.slice(0, 4)

  return (
    <div className={s.wrapper}>
      {patternKeys.map((name) => {
        // @ts-expect-error
        const { bgImage } = patternWallpapers[name]
        const bgSrc = bgImage === '/wallpaper/ms.svg' ? '/wallpaper/ms.png' : bgImage

        return (
          <div className={cn(s.block, name === wallpaper && s.blockActive)} key={name}>
            {name === wallpaper && (
              <div className={s.activeSign}>
                <CheckedSVG className={s.checkIcon} />
              </div>
            )}
            <Img className={s.image} src={bgSrc} onClick={() => changePatternWallpaper(name)} />
          </div>
        )
      })}

      <div className={s.showMoreMask}>
        <Button
          ghost
          noBorder
          size='small'
          space={3}
          top={10}
          soft={showMore}
          onClick={() => setShowMore(!showMore)}
        >
          <CircleArrowSVG className={s.showMoreIcon} />
          {!showMore ? <>查看全部</> : <>收起</>}
        </Button>
      </div>
    </div>
  )
}
