import type { TBorderHighlight, TCoverImageWhich } from '../../../../../spec'
import ColorControl from './ColorControl'
import HighlightControl from './HighlightControl'
import useSalon from './salon'

type TProps = {
  borderHighlight: TBorderHighlight
  showColorControl?: boolean
  which: TCoverImageWhich
}

export default function Controller({ borderHighlight, showColorControl = true, which }: TProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <HighlightControl borderHighlight={borderHighlight} which={which} />
      {showColorControl && <ColorControl borderHighlight={borderHighlight} which={which} />}
    </div>
  )
}
