import useSalon from './salon/mini_bars'

type TProps = {
  titleColor: string
  digestColor: string
}

export default function MiniTextBar({ titleColor, digestColor }: TProps) {
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
