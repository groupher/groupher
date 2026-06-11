import RangeInput from '~/widgets/RangeInput'

import { IMAGE_SIZE_RANGE } from '../../../../constant'
import { useImageDraftContext } from '../../../../imageDraftContext'
import type { TCoverImageWhich, TImageSize } from '../../../../spec'
import GroupItem from '../../GroupItem'
import useSalon from './salon'

type TProps = {
  size: TImageSize
  which: TCoverImageWhich
}

export default function Size({ size, which }: TProps) {
  const s = useSalon()
  const { flushImageDraft, scheduleImagePatch } = useImageDraftContext()

  return (
    <section className={s.wrapper}>
      <GroupItem label='Size'>
        <div className={s.rangeRow}>
          <RangeInput
            value={size}
            min={IMAGE_SIZE_RANGE.MIN}
            max={IMAGE_SIZE_RANGE.MAX}
            step={1}
            width='w-36'
            valueLabel='Size'
            aria-label='Size'
            hideLabel
            onChange={(nextSize) => scheduleImagePatch(which, { size: nextSize })}
            onChangeEnd={flushImageDraft}
          />
        </div>
      </GroupItem>
    </section>
  )
}
