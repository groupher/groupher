import useSalon from './salon'
import type { TTextBarProps } from './spec'

export default function MiniTextBar({ titleColor, digestColor }: TTextBarProps) {
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
