import type { TBorderHighlight } from '../../../../../spec'
import ColorControl from './ColorControl'
import HighlightControl from './HighlightControl'
import useSalon from './salon'

type TProps = {
  borderHighlight: TBorderHighlight
  showColorControl?: boolean
}

export default function Controller({ borderHighlight, showColorControl = true }: TProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <HighlightControl borderHighlight={borderHighlight} />
      {showColorControl && <ColorControl borderHighlight={borderHighlight} />}
    </div>
  )
}
