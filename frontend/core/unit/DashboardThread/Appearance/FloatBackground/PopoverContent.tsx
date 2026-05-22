import useSalon, { cnMerge } from './salon'

type TProps = {
  dark?: boolean
}

export default function PopoverContent({ dark = false }: TProps) {
  const s = useSalon()
  const tone = dark ? 'bg-white' : 'bg-black'

  return (
    <div className={s.popoverBody}>
      <div className={cnMerge(s.bar, s.popoverTitle, tone)} />
      <div className={cnMerge(s.bar, s.popoverBodyWide, tone)} />
      <div className={cnMerge(s.bar, s.popoverBodyNarrow, tone)} />
    </div>
  )
}
