import { blurRGB } from '~/fmt'
import useThemeData from '~/hooks/useThemeData'

import RangeSlider from '~/widgets/RangeSlider'

import useWallpaper from '~/hooks/useWallpaper'

import { SETTING_FIELD } from '../../constant'
import SectionLabel from '../../SectionLabel'
import SavingBar from '../../SavingBar'

import useGossBlur from '../../logic/useGossBlur'

import useSalon, { cn } from '../../salon/layout/goss_blur'

export default () => {
  const s = useSalon()

  const { gossBlurDark, saving, getIsDarkTouched, edit } = useGossBlur()
  const { wallpaper, background } = useWallpaper()

  const themeData = useThemeData()

  const bgColor = `${blurRGB(themeData.htmlBg, gossBlurDark)}`
  const isTouched = getIsDarkTouched()

  return (
    <div className={s.wrapper} key={wallpaper}>
      <SectionLabel
        title="毛玻璃效果 (dark)"
        desc="主要页面的高斯模糊值，类似主流音乐播放器效果"
        classNames="pr-8"
        withThemeSelect
      />

      <div className={s.content}>
        <div className={s.previewer}>
          <div className={s.previewImage} style={{ background }} />
          <div className={s.contentBlock} style={{ background: bgColor }}>
            <div className={cn(s.bar)} />
            <div className={cn(s.bar, 'top-10 w-40 opacity-20')} />

            <div className={cn(s.bar, 'top-16 w-28')} />
            <div className={cn(s.bar, 'top-20 w-44 opacity-20')} />

            <div className={cn(s.bar, 'top-24 w-16 opacity-30 mt-2')} />
            <div className={cn(s.bar, 'top-28 w-32 opacity-15 mt-2')} />

            <div className={cn(s.bar, 'bottom-20 w-28 opacity-30')} />
            <div className={cn(s.bar, 'bottom-16 w-44 opacity-15')} />

            <div className={cn(s.bar, 'bottom-8 w-28 opacity-20')} />
            <div className={cn(s.bar, 'bottom-4 w-44 opacity-10')} />
          </div>
        </div>
        <ul className={s.actions}>
          <h3 className={s.title}>透明度</h3>
          <li className={s.desc}>默认为无模糊白（黑）色背景。</li>
          <li className={s.desc}>透明度过低会导致内容无法辨认。</li>
          <li className={s.desc}>个别浏览器不支持相应特性，会导致效果失效。</li>
          <li className={s.desc}>
            可根据<span className={s.highlight}>浅色</span>/
            <span className={s.highlight}>暗色</span>主题
            <span className={s.highlight}>分别设置</span>。
          </li>

          <br />
          <RangeSlider
            value={gossBlurDark}
            onChange={(v) => edit(v, 'gossBlurDark')}
            top={5}
            min={50}
            max={100}
            width="w-10/12"
            unit="%"
          />
        </ul>
      </div>

      <SavingBar
        width="96%"
        isTouched={isTouched}
        field={SETTING_FIELD.GOSS_BLUR_DARK}
        loading={saving}
        top={20}
      />
    </div>
  )
}
