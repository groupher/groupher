import { useState } from 'react'

import { useImageDraftContext } from '../imageDraftContext'
import type { TCoverImageWhich } from '../spec'
import useLogic from '../useLogic'
import DetailPanel from './DetailPanel'
import HudPanel from './HudPanel'
import useSalon from './salon'

type TProps = {
  defaultExpanded?: boolean
  onAddImage: (which: TCoverImageWhich) => void
  onDelete: (which: TCoverImageWhich) => void
  onReplace: (which: TCoverImageWhich) => void
}

export default function TuningPanel({
  defaultExpanded = false,
  onAddImage,
  onDelete,
  onReplace,
}: TProps) {
  const s = useSalon()
  const { tuningSetting } = useLogic()
  const { activeImage, activeImageWhich, images } = useImageDraftContext()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const setting = {
    ...tuningSetting,
    images,
    activeImageWhich,
    activeImage,
  }

  return (
    <div className={s.wrapper}>
      <div className={s.panelContent}>
        {expanded ? (
          <DetailPanel
            setting={setting}
            onAddImage={onAddImage}
            onDelete={onDelete}
            onReplace={onReplace}
            onCollapse={() => setExpanded(false)}
          />
        ) : (
          <HudPanel setting={setting} onExpand={() => setExpanded(true)} />
        )}
      </div>
    </div>
  )
}
