import MiniColorBar from './MiniColorBar'
import MiniTextBar from './MiniTextBar'
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
