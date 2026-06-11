import { COVER_SHADOW_PRESET } from '../../../../constant'
import type { TCoverImageWhich, TCoverShadow } from '../../../../spec'
import ColorModeGrid from './ColorModeGrid'
import CustomFields from './CustomFields'
import PresetGrid from './PresetGrid'
import useSalon from './salon/panel'

type TProps = {
  shadow: TCoverShadow
  which: TCoverImageWhich
}

export default function Panel({ shadow, which }: TProps) {
  const s = useSalon()

  return (
    <div className={s.panel}>
      <PresetGrid shadow={shadow} which={which} />
      <ColorModeGrid shadow={shadow} which={which} />
      <CustomFields
        shadow={shadow}
        showCustom={shadow.preset === COVER_SHADOW_PRESET.CUSTOM}
        which={which}
      />
    </div>
  )
}
