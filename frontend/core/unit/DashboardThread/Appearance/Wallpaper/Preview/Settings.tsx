import SIZE from '~/const/size'
import { WALLPAPER_TYPE } from '~/const/wallpaper'
import useTrans from '~/hooks/useTrans'
import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'

import useSalon, { cn } from '../salon/preview/settings'
import useLogic from '../useLogic'
import AnglePanel from './AnglePanel'

export default function Settings() {
  const { getWallpaper, togglePattern, toggleBlur, toggleShadow } = useLogic()
  const { type, hasPattern, hasBlur, hasShadow } = getWallpaper()
  const { t } = useTrans()
  const s = useSalon()

  const isGradient = type === WALLPAPER_TYPE.GRADIENT || type === WALLPAPER_TYPE.CUSTOM_GRADIENT

  if (type === WALLPAPER_TYPE.NONE) return null

  return (
    <div className={s.wrapper}>
      <div className={s.effects}>
        <div className={s.title}>{t('dsb.appearance.wallpaper.editor.effects')}:</div>
        <div className={s.effectRows}>
          {isGradient && (
            <div className={s.switchWrapper}>
              <div className={s.toggleTitle}>{t('dsb.appearance.wallpaper.editor.pattern')}</div>
              <ToggleSwitch size={SIZE.TINY} checked={hasPattern} onChange={togglePattern} />
            </div>
          )}
          <div className={s.switchWrapper}>
            <div className={s.toggleTitle}>{t('dsb.appearance.wallpaper.editor.blur')}</div>
            <ToggleSwitch size={SIZE.TINY} checked={hasBlur} onChange={toggleBlur} />
          </div>

          <div className={s.switchWrapper}>
            <div className={s.toggleTitle}>{t('dsb.appearance.wallpaper.editor.shadow')}</div>
            <ToggleSwitch size={SIZE.TINY} checked={hasShadow} onChange={toggleShadow} />
          </div>
        </div>
      </div>

      {isGradient && (
        <div className={s.angleSettings}>
          <div className={cn(s.title, 'mb-2.5')}>
            {t('dsb.appearance.wallpaper.editor.gradient_direction')}:
          </div>
          <AnglePanel />
        </div>
      )}
    </div>
  )
}
