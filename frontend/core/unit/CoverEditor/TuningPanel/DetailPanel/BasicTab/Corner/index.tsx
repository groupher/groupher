import RangeInput from '~/widgets/RangeInput'

import { IMAGE_BORDER_RADIUS_RANGE } from '../../../../constant'
import { useImageDraftContext } from '../../../../imageDraftContext'
import type { TCoverImageWhich } from '../../../../spec'
import GroupItem from '../../GroupItem'
import useSalon from './salon'

type TProps = {
  borderRadius: number
  which: TCoverImageWhich
}

export default function Corner({ borderRadius, which }: TProps) {
  const s = useSalon()
  const { flushImageDraft, scheduleImagePatch } = useImageDraftContext()

  return (
    <section className={s.wrapper}>
      <GroupItem label='Corner'>
        <div className={s.rangeRow}>
          <RangeInput
            value={borderRadius}
            min={IMAGE_BORDER_RADIUS_RANGE.MIN}
            max={IMAGE_BORDER_RADIUS_RANGE.MAX}
            step={1}
            width='w-36'
            valueLabel='Corner'
            aria-label='Corner'
            hideLabel
            onChange={(nextBorderRadius) =>
              scheduleImagePatch(which, { borderRadius: nextBorderRadius })
            }
            onChangeEnd={flushImageDraft}
          />
        </div>
      </GroupItem>
    </section>
  )
}
