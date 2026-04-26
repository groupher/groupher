import { WALLPAPER_TYPE } from '~/const/wallpaper'
import ForbidSVG from '~/icons/ForbidImg'
import Button from '~/widgets/Buttons/Button'
import YesOrNoButtons from '~/widgets/Buttons/YesOrNoButtons'

import useSalon from './salon/footer'
import useLogic from './useLogic'

export default function Footer() {
  const s = useSalon()

  const { getWallpaper, loading, isTouched, removeWallpaper, onSave, rollbackWallpaper } =
    useLogic()
  const { wallpaperType } = getWallpaper()

  return (
    <div className={s.wrapper}>
      <div className={s.divider} />
      <div className={s.inner}>
        {wallpaperType !== WALLPAPER_TYPE.NONE ? (
          <Button size='small' ghost onClick={() => removeWallpaper()}>
            <ForbidSVG className={s.blankIcon} /> 空白壁纸
          </Button>
        ) : (
          <div />
        )}
        <div className='grow' />

        {isTouched ? (
          <YesOrNoButtons
            cancelText='恢复默认'
            saveText='确定'
            space={4}
            onCancel={() => {
              rollbackWallpaper()
            }}
            onConfirm={() => onSave()}
          />
        ) : (
          <Button size='small' space={10} loading={loading} onClick={() => onSave()}>
            确定
          </Button>
        )}
      </div>
    </div>
  )
}
