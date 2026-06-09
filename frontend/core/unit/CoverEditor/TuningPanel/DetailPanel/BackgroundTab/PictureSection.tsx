import { PATTERN_WALLPAPER, WALLPAPER_TYPE } from '~/const/wallpaper'
import { cnMerge } from '~/css'
import type { TBgConfig } from '~/lib/bg/spec'

import useLogic from '../../../useLogic'
import GroupTitle from '../GroupTitle'
import useSalon from './salon/pictures'

type TProps = {
  background: TBgConfig
}

export default function PictureSection({ background }: TProps) {
  const s = useSalon()
  const { pictureBackgroundOnChange } = useLogic()

  return (
    <div className={s.section}>
      <GroupTitle>Pictures</GroupTitle>
      <div className={s.pictureGrid}>
        {Object.entries(PATTERN_WALLPAPER)
          .slice(0, 8)
          .map(([key, picture]) => {
            const selected = background.type === WALLPAPER_TYPE.PATTERN && background.source === key

            return (
              <button
                type='button'
                key={key}
                className={cnMerge(s.pictureCard, selected && s.pictureCardActive)}
                aria-label={key}
                title={key}
                onClick={() => pictureBackgroundOnChange(key)}
              >
                <img className={s.pictureImage} src={picture.preview ?? picture.image} alt='' />
              </button>
            )
          })}
      </div>
    </div>
  )
}
