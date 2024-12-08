import { WALLPAPER_TYPE } from '~/const/wallpaper'

import YesOrNoButtons from '~/widgets/Buttons/YesOrNoButtons'
import Button from '~/widgets/Buttons/Button'

import ForbidSVG from '~/icons/ForbidImg'

import useLogic from './useLogic'
import useSalon from './salon/footer'

export default () => {
  const s = useSalon()

  const { getWallpaper, loading, getIsTouched, removeWallpaper, onSave, rollbackWallpaper } =
    useLogic()
  const { wallpaperType } = getWallpaper()
  const isTouched = getIsTouched()

  return (
    <div className={s.wrapper}>
      <div className={s.divider} />
      <div className={s.inner}>
        {wallpaperType !== WALLPAPER_TYPE.NONE ? (
          <Button size="small" ghost onClick={() => removeWallpaper()}>
            <ForbidSVG className={s.blankIcon} /> 空白壁纸
          </Button>
        ) : (
          <div />
        )}
        <div className="grow" />

        {isTouched ? (
          <YesOrNoButtons
            cancelText="恢复默认"
            confirmText="确定"
            space={4}
            onCancel={() => {
              rollbackWallpaper()
            }}
            onConfirm={() => onSave()}
          />
        ) : (
          <Button size="small" space={10} loading={loading} onClick={() => onSave()}>
            确定
          </Button>
        )}
      </div>
    </div>
  )
}
