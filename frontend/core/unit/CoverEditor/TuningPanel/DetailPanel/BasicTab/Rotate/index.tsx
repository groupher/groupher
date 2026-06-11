import AngleWheel from '~/widgets/AngleWheel'

import { useImageDraftContext } from '../../../../imageDraftContext'
import type { TCoverImageWhich } from '../../../../spec'
import GroupItem from '../../GroupItem'
import useSalon from './salon'

type TProps = {
  rotate: number
  which: TCoverImageWhich
}

export default function Rotate({ rotate, which }: TProps) {
  const s = useSalon()
  const { flushImageDraft, scheduleImagePatch } = useImageDraftContext()

  return (
    <section className={s.wrapper}>
      <GroupItem label='Angle'>
        <AngleWheel
          value={rotate}
          label='Angle'
          onChange={(nextRotate) => scheduleImagePatch(which, { rotate: nextRotate })}
          onCommit={flushImageDraft}
        />
      </GroupItem>
    </section>
  )
}
