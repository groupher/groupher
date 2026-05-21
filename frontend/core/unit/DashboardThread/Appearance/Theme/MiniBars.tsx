import useSalon from './salon/mini_bars'

type TProps = {
  active: boolean
  primaryColor: string
  accentColor: string
  textTitle: string
  textDigest: string
}

export default function MiniBars({
  active,
  primaryColor,
  accentColor,
  textTitle,
  textDigest,
}: TProps) {
  const s = useSalon({ active })

  return (
    <div className={s.bars}>
      <MiniColorBar color={primaryColor} className={s.primaryBar} />
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

function MiniColorBar({ color, className }: { color: string; className?: string }) {
  return <span className={className} style={{ backgroundColor: color }} />
}
