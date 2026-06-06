import AngleWheelControl from '~/widgets/AngleWheel'

import useLogic from '../../useLogic'

export default function AnglePanel() {
  const { angleDraft, changeAngle, flushWallpaperDraft } = useLogic()

  return (
    <AngleWheelControl value={angleDraft} onChange={changeAngle} onCommit={flushWallpaperDraft} />
  )
}
