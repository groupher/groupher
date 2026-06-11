import { useImageDraftContext } from '../../../../imageDraftContext'
import type { TCoverImageWhich, TCoverPoint, TImageSize } from '../../../../spec'
import GroupItem from '../../GroupItem'
import Controller from './Controller'
import useSalon from './salon'

type TProps = {
  position: TCoverPoint
  size: TImageSize
  rotate: number
  which: TCoverImageWhich
}

export default function Position({ position, size, rotate, which }: TProps) {
  const { flushImageDraft, scheduleImagePatch } = useImageDraftContext()
  const s = useSalon()

  return (
    <section className={s.wrapper}>
      <GroupItem label='Position'>
        <Controller
          position={position}
          size={size}
          rotate={rotate}
          onChange={(nextPosition) => scheduleImagePatch(which, { position: nextPosition })}
          onCommit={flushImageDraft}
        />
      </GroupItem>
    </section>
  )
}
