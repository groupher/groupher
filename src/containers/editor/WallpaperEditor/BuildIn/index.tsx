/* *
 * WallpaperEditor
 *
 */

import { WALLPAPER_TYPE } from '~/const/wallpaper'

import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'

import PictureGroup from './PictureGroup'
import GradientGroup from './GradientGroup'
import CustomGradientEditor from './CustomGradientEditor'
import AnglePanel from './AnglePanel'

import useLogic from '../useLogic'
import useSalon, { cn } from '../styles/build_in'

export default () => {
  const { getWallpaper, togglePattern, toggleBlur, toggleShadow } = useLogic()
  const { wallpaperType, hasPattern, hasBlur, hasShadow } = getWallpaper()

  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>渐变:</div>
      <GradientGroup />
      {wallpaperType === WALLPAPER_TYPE.CUSTOM_GRADIENT && <CustomGradientEditor />}
      <div className="mt-6" />
      <div className={s.title}>图片:</div>
      <PictureGroup />
      <div className={s.divider} />
      <div className={cn(s.settingWrapper, !(wallpaperType !== WALLPAPER_TYPE.NONE) && 'hidden')}>
        <div className={s.generalSettings}>
          <div className={s.title}>附加效果:</div>
          {wallpaperType === WALLPAPER_TYPE.GRADIENT && (
            <div className={s.switchWrapper}>
              <div className={s.toggleTitle}>叠加花纹</div>
              <ToggleSwitch checked={hasPattern} onChange={togglePattern} />
            </div>
          )}
          <div className="mt-1.5" />
          <div className={s.switchWrapper}>
            <div className={s.toggleTitle}>模糊效果</div>
            <ToggleSwitch checked={hasBlur} onChange={toggleBlur} />
          </div>

          <div className="mt-1.5" />
          <div className={s.switchWrapper}>
            <div className={s.toggleTitle}>阴影效果</div>
            <ToggleSwitch checked={hasShadow} onChange={toggleShadow} />
          </div>
        </div>

        {wallpaperType === WALLPAPER_TYPE.GRADIENT && (
          <>
            <div className={s.dividerV} />
            <div className={s.angleSettings}>
              <div className={s.title}>渐变方向:</div>
              <AnglePanel />
            </div>
          </>
        )}
      </div>
      <div className="mt-20" />
    </div>
  )
}
