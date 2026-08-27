import MiniColorBar from './MiniColorBar'
import MiniTextBar from './MiniTextBar'
import useSalon from './salon'
import type { TProps } from './spec'

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
