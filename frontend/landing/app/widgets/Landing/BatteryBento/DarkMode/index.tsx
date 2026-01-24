import { useEffect, useRef } from 'react'
import THEME from '~/const/theme'
import useHover from '~/hooks/useHover'
import useTheme from '~/hooks/useTheme'
import StarSVG from '~/icons/Star'
import useSalon, { cn } from '../../salon/battery_bento/dark_mode'
import Panel from './Panel'

export default function DarkMode() {
  const s = useSalon()
  const { toggle, theme } = useTheme()

  const [ref, isHovered] = useHover<HTMLDivElement>()

  const prevHoveredRef = useRef(false)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const entered = isHovered && !prevHoveredRef.current
    const left = !isHovered && prevHoveredRef.current

    prevHoveredRef.current = isHovered

    if (entered) {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)

      hoverTimeoutRef.current = setTimeout(() => {
        hoverTimeoutRef.current = null
        toggle()
      }, 300)
    }

    if (left && hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }, [isHovered, toggle])

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    }
  }, [])

  const showStars = isHovered || theme === THEME.DARK

  return (
    <div className={s.wrapper} ref={ref}>
      <div className={cn(s.inner, isHovered && '-rotate-180')} />
      {showStars && <StarSVG className={cn(s.starIcon, 'top-3 right-8')} />}
      {showStars && <StarSVG className={cn(s.starIcon, 'top-6 right-3 !opacity-50')} />}

      <Panel hovering={isHovered} />
      <div className={s.footer}>
        <h3 className={s.title}>暗黑模式</h3>
        <div className={s.desc}>精心设计的的双色主题，同时适配各种自定义设置。</div>
      </div>
    </div>
  )
}
