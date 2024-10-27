import type { FC } from 'react'

import AnimatedCount from '~/widgets/AnimatedCount'

import useSalon, { cn } from '../../salon/battery_bento/statistics/chart_card'

type TProps = {
  hovering: boolean
}

const ChartCard: FC<TProps> = ({ hovering }) => {
  const s = useSalon()

  const flipCount = hovering ? 152 : 23

  return (
    <div>
      <div className={cn(s.column, 'right-12')} />
      <div className={cn(s.column, 'right-32')} />

      <div className={cn(s.column, 'right-24 mr-1.5', !hovering && 'opacity-0')} />
      <div className={cn(s.column, 'right-16 mr-3', hovering && 'opacity-0')} />

      <div className={cn(s.highlightColumn, hovering && s.highlightColumnHover)} />
      <div
        className={cn(s.highlightDot, hovering && s.highlightDotHover)}
        style={s.dotBorderStyle}
      />

      <div className={s.wrapper} style={{ backgroundImage: s.gradientBg }}>
        <div className={s.trendText}>实时访客</div>

        <div className={s.trendNum}>
          <AnimatedCount count={flipCount} size="large" />
        </div>

        <div className={s.topGradient} style={{ background: s.topGradientBg }} />
        <div className={s.bottomGradient} style={{ background: s.bottomGradientBg }} />
      </div>
    </div>
  )
}

export default ChartCard
