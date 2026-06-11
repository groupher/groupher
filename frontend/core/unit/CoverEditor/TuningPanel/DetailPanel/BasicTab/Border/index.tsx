import RangeInput from '~/widgets/RangeInput'

import { IMAGE_BORDER_RADIUS_RANGE } from '../../../../constant'
import { useImageDraftContext } from '../../../../imageDraftContext'
import type { TBorderHighlight, TCoverGlassBorder, TCoverImageWhich } from '../../../../spec'
import useLogic from '../../../../useLogic'
import GroupItem from '../../GroupItem'
import Controller from './Controller'
import GlassFrameControl from './GlassFrameControl'
import useSalon from './salon'

type TProps = {
  borderRadius: number
  borderHighlight: TBorderHighlight
  glassBorder: TCoverGlassBorder
  which: TCoverImageWhich
}

export default function Border({ borderRadius, borderHighlight, glassBorder, which }: TProps) {
  const s = useSalon()
  const { glassBorderOnChange } = useLogic()
  const { flushImageDraft, scheduleImagePatch } = useImageDraftContext()

  return (
    <section className={s.wrapper}>
      <div className={s.items}>
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

        <GroupItem label='Border'>
          <Controller borderHighlight={borderHighlight} which={which} />
        </GroupItem>

        <GroupItem label='Frame'>
          <GlassFrameControl
            enabled={glassBorder.enabled}
            onToggle={() => glassBorderOnChange(which, !glassBorder.enabled)}
          />
        </GroupItem>
      </div>
    </section>
  )
}
