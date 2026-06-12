import { WALLPAPER_TYPE } from '~/const/wallpaper'
import CheckedSVG from '~/icons/CheckBold'
import type { TBgConfig } from '~/lib/bg'

import { COVER_PICTURE_WALLPAPER } from '../../../background'
import useLogic from '../../../useLogic'
import GroupTitle from '../GroupTitle'
import useSalon from './salon/pictures'

type TProps = {
  background: TBgConfig
}

export default function Pictures({ background }: TProps) {
  const s = useSalon()
  const { pictureBackgroundOnChange } = useLogic()

  return (
    <div className={s.section}>
      <GroupTitle>Pictures</GroupTitle>
      <div className={s.pictureGrid}>
        {Object.entries(COVER_PICTURE_WALLPAPER)
          .slice(0, 8)
          .map(([key, picture]) => {
            const selected = background.type === WALLPAPER_TYPE.PATTERN && background.source === key

            return (
              <button
                type='button'
                key={key}
                aria-label={key}
                aria-pressed={selected}
                className={s.button(selected)}
                onClick={() => {
                  if (!selected) {
                    pictureBackgroundOnChange(key)
                  }
                }}
              >
                {selected && (
                  <span className={s.activeSign}>
                    <CheckedSVG className={s.checkIcon} />
                  </span>
                )}
                <span className={s.pictureContent}>
                  <img className={s.pictureImage} src={picture.preview ?? picture.image} alt='' />
                </span>
              </button>
            )
          })}
      </div>
    </div>
  )
}
