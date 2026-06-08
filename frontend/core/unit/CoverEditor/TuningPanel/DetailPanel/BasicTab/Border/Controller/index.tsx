import type { TBorderHighlight } from '../../../../../spec'
import ColorControl from './ColorControl'
import HighlightControl from './HighlightControl'
import useSalon from './salon'

type TProps = {
  borderHighlight: TBorderHighlight
}

export default function Controller({ borderHighlight }: TProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <HighlightControl borderHighlight={borderHighlight} />
      <ColorControl borderHighlight={borderHighlight} />
    </div>
  )
}
