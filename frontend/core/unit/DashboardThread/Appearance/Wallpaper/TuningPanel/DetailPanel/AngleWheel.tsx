import AngleField from '~/widgets/TuningFields/AngleField'

import useLogic from '../../useLogic'

export default function AnglePanel() {
  const { angleDraft, changeAngle, flushWallpaperDraft } = useLogic()

  return <AngleField value={angleDraft} onChange={changeAngle} onCommit={flushWallpaperDraft} />
}
