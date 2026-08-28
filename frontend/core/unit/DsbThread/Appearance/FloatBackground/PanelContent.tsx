import useSalon, { cnMerge } from './salon'

type TProps = {
  dark?: boolean
}

export default function PanelContent({ dark = false }: TProps) {
  const s = useSalon()
  const tone = dark ? 'bg-white' : undefined

  return (
    <>
      <div className={cnMerge(s.bar, s.panelTitle, tone)} />
      <div className={cnMerge(s.bar, s.panelShort, tone)} />
      <div className={cnMerge(s.bar, s.panelWide, tone)} />
      <div className={cnMerge(s.bar, s.panelMid, tone)} />
      <div className={cnMerge(s.bar, s.panelNarrow, tone)} />
      <div className={cnMerge(s.bar, s.panelWideDim, tone)} />
      <div className={cnMerge(s.bar, s.panelWideDim, tone)} />
    </>
  )
}
