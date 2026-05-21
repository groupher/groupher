import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

import useSalon from './salon/mini_bars'

type TProps = {
  active: boolean
  primaryColor: TColorName
  primaryCustomColor?: string
  accentColor: TColorName
  textTitle: string
  textDigest: string
}

export default function MiniBars({
  active,
  primaryColor,
  primaryCustomColor,
  accentColor,
  textTitle,
  textDigest,
}: TProps) {
  const s = useSalon({ active })

  return (
    <div className={s.bars}>
      <MiniColorBar
        color={primaryColor}
        customColor={primaryCustomColor}
        className={s.primaryBar}
      />
      <MiniColorBar color={accentColor} className={s.subBar} />
      <MiniTextBar titleColor={textTitle} digestColor={textDigest} />
    </div>
  )
}

function MiniTextBar({ titleColor, digestColor }: { titleColor: string; digestColor: string }) {
  const s = useSalon()

  return (
    <span
      className={s.textBar}
      style={{
        background: `linear-gradient(90deg, ${titleColor} 0 50%, ${digestColor} 50% 100%)`,
      }}
    />
  )
}

function MiniColorBar({
  color,
  customColor,
  className,
}: {
  color: TColorName
  customColor?: string
  className?: string
}) {
  const { cn, rainbow } = useTwBelt()

  return (
    <span
      className={cn(
        className,
        color === COLOR.CUSTOM ? 'border border-divider' : rainbow(color, 'bg'),
      )}
      style={color === COLOR.CUSTOM ? { backgroundColor: customColor } : undefined}
    />
  )
}
