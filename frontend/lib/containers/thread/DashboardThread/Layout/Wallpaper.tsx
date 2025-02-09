import { useCallback } from 'react'

import { WIDTH } from '~/css'
import { callWallpaperEditor } from '~/signal'
import { blurRGB } from '~/fmt'

import useThemeData from '~/hooks/useThemeData'
import useGossBlur from '~/hooks/useGossBlur'
import useWallpaper from '~/hooks/useWallpaper'

import SettingSVG from '~/icons/Setting'
import CheckLabel from '~/widgets/CheckLabel'

import SectionLabel from '../SectionLabel'

import useSalon, { cn } from '../salon/layout/wallpaper'

export default () => {
  const s = useSalon()

  const gossBlur = useGossBlur()
  const { background } = useWallpaper()

  const themeData = useThemeData()

  const handleCallEditor = useCallback(() => callWallpaperEditor(), [])
  const bgColor = `${blurRGB(themeData.htmlBg, gossBlur)}`

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title="壁纸设置"
        desc={
          <>
            「壁纸」为宽屏（屏幕尺寸大于 {WIDTH.COMMUNITY.PAGE}
            ）下，超出内容部分显示的背景图片，除内置壁纸外，你还可以上传和社区话题相关的自定义图片。
          </>
        }
        width="96%"
      />

      <div className={s.preview}>
        <div className={s.hoverMask} onClick={handleCallEditor}>
          <SettingSVG className={s.settingIcon} />
          <div className={cn(s.previewImage, 'group-hover:brightness-90')} style={{ background }} />
          <CheckLabel title="原图" top={4} active={false} />
        </div>
        <div className={s.previewer}>
          <div className={s.realPreview}>
            <div className={s.previewImage} style={{ background }} />
            <div className={s.content} style={{ background: bgColor }}>
              <div className={cn(s.bar, 'top-3')} />
              <div className={cn(s.bar, 'top-8 w-40 opacity-20')} />

              <div className={cn(s.bar, 'top-14 w-32 opacity-30')} />
              <div className={cn(s.bar, 'top-20 w-44 -mt-1.5 opacity-20')} />

              <div className={cn(s.bar, 'top-24 w-20 opacity-20')} />
              <div className={cn(s.bar, 'top-28 w-32 mt-0.5 opacity-10')} />

              <div className={cn(s.bar, 'bottom-8 w-14 opacity-15')} />
              <div className={cn(s.bar, 'bottom-4 w-32 mt-0.5 opacity-10')} />
            </div>
          </div>
          <CheckLabel title="预览效果" top={4} active={false} />
        </div>
      </div>
    </div>
  )
}
