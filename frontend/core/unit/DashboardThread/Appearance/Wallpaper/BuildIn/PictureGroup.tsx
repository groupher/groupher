import { keys } from 'ramda'

import CheckedSVG from '~/icons/CheckBold'

import useSalon, { cn } from '../salon/build_in/pictrue_group'
import useLogic from '../useLogic'

export default function PictureGroup() {
  const { getWallpaper, changePatternWallpaper } = useLogic()
  const { source, patternWallpapers } = getWallpaper()

  const s = useSalon()

  const patternKeys = keys(patternWallpapers)

  return (
    <div className={s.wrapper}>
      {patternKeys.map((name) => {
        // @ts-expect-error
        const { bgImage } = patternWallpapers[name]
        const bgSrc = bgImage === '/wallpaper/ms.svg' ? '/wallpaper/ms.png' : bgImage

        return (
          <button
            type='button'
            className={cn(s.block, name === source && s.blockActive)}
            key={name}
            onClick={() => changePatternWallpaper(name)}
          >
            {name === source && (
              <div className={s.activeSign}>
                <CheckedSVG className={s.checkIcon} />
              </div>
            )}
            <img className={s.image} src={bgSrc} alt='' />
          </button>
        )
      })}
    </div>
  )
}
