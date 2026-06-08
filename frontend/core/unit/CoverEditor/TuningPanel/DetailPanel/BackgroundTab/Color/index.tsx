import { COVER_GRADIENT_WALLPAPER } from '~/const/wallpaper'
import { parseCoreBgWallpaper } from '~/lib/coreBg/parse'
import type { TWallpaper } from '~/spec'

import useLogic from '../../../../useLogic'
import GroupItem from '../../GroupItem'
import useSalon, { cn } from './salon'

type TProps = {
  wallpapers: Record<string, TWallpaper>
  wallpaper: string
}

export default function Color({ wallpapers, wallpaper }: TProps) {
  const s = useSalon()
  const { wallpaperOnChange } = useLogic()

  return (
    <GroupItem label='Color' align='start'>
      <div className={s.bgRow}>
        <button
          type='button'
          className={cn(s.imageItem, wallpaper === '' && s.imageItemActive)}
          onClick={() => wallpaperOnChange('')}
        >
          <span className={s.imageBlock} />
        </button>

        {Object.keys(COVER_GRADIENT_WALLPAPER).map((themeName) => (
          <button
            key={themeName}
            type='button'
            className={cn(s.imageItem, wallpaper === themeName && s.imageItemActive)}
            onClick={() => wallpaperOnChange(themeName)}
          >
            <span
              className={s.imageBlock}
              style={{ background: parseCoreBgWallpaper(wallpapers, themeName).background }}
            />
          </button>
        ))}
      </div>
    </GroupItem>
  )
}
