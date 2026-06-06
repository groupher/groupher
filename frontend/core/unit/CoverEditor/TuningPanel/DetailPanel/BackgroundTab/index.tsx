import type { TWallpaper, TWallpaperGradientDir } from '~/spec'

import GroupTitle from '../GroupTitle'
import Color from './Color'
import Direction from './Direction'
import useSalon from './salon'

type TProps = {
  wallpapers: Record<string, TWallpaper>
  wallpaper: string
  direction: TWallpaperGradientDir
}

export default function BackgroundTab({ wallpapers, wallpaper, direction }: TProps) {
  const s = useSalon()

  return (
    <section className={s.wrapper}>
      <GroupTitle>Background</GroupTitle>

      <div className={s.items}>
        <Color wallpapers={wallpapers} wallpaper={wallpaper} />
        <Direction direction={direction} />
      </div>
    </section>
  )
}
