import StarSVG from '~/icons/Star'

import useHover from '~/hooks/useHover'
import useTheme from '~/hooks/useTheme'

import Panel from './Panel'

import useSalon, { cn } from '../../salon/battery_bento/dark_mode'

export default () => {
  const s = useSalon()

  const { toggle } = useTheme()

  const [ref, isHovered] = useHover<HTMLDivElement>()

  return (
    <div className={s.wrapper} ref={ref} onClick={() => toggle()}>
      <div className={cn(s.inner, isHovered && '-rotate-180')} />
      {isHovered && <StarSVG className={cn(s.starIcon, 'top-3 right-8')} />}
      {isHovered && <StarSVG className={cn(s.starIcon, 'top-6 right-3 !opacity-50')} />}

      <Panel hovering={isHovered} />
      <div className={s.footer}>
        <h3 className={s.title}>暗黑模式</h3>
        <div className={s.desc}>精心设计的的双色主题，同时适配各种自定义设置。</div>
      </div>
    </div>
  )
}
