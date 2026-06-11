import { useImageDraftContext } from '../../../../imageDraftContext'
import type { TCoverImageWhich, TCoverPoint } from '../../../../spec'
import useLogic from '../../../../useLogic'
import GroupItem from '../../GroupItem'
import MagnifierControl from './Control'
import useSalon from './salon'

type TProps = {
  center: TCoverPoint
  radius: number
  zoom: number
  enabled: boolean
  which: TCoverImageWhich
}

export default function Magnifier({ center, radius, zoom, enabled, which }: TProps) {
  const s = useSalon()
  const { magnifierOnChange } = useLogic()
  const { flushImageDraft, scheduleImagePatch } = useImageDraftContext()

  return (
    <section className={s.wrapper}>
      <GroupItem label='Position'>
        <MagnifierControl
          value={{ center, radius, zoom }}
          label='Magnifier position'
          disabled={!enabled}
          onChange={(next) => {
            scheduleImagePatch(which, {
              magnifier: {
                center: next.center,
                radius: next.radius,
                zoom: next.zoom,
                enabled: true,
              },
            })
          }}
          onToggle={() => magnifierOnChange(which, !enabled)}
          onCommit={flushImageDraft}
        />
      </GroupItem>
    </section>
  )
}
