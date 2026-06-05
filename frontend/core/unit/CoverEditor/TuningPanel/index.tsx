import { useState } from 'react'

import useLogic from '../useLogic'
import DetailPanel from './DetailPanel'
import HudPanel from './HudPanel'
import useSalon from './salon'

type TProps = {
  defaultExpanded?: boolean
  onDelete: () => void
  onReplace: () => void
}

export default function TuningPanel({ defaultExpanded = false, onDelete, onReplace }: TProps) {
  const s = useSalon()
  const { tuningSetting } = useLogic()
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className={s.wrapper}>
      <div className={s.panelContent}>
        {expanded ? (
          <DetailPanel
            setting={tuningSetting}
            onDelete={onDelete}
            onReplace={onReplace}
            onCollapse={() => setExpanded(false)}
          />
        ) : (
          <HudPanel setting={tuningSetting} onExpand={() => setExpanded(true)} />
        )}
      </div>
    </div>
  )
}
