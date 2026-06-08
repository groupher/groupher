import { COVER_SHADOW_PRESET } from '../../../../constant'
import type { TCoverShadow } from '../../../../spec'
import ColorModeGrid from './ColorModeGrid'
import CustomFields from './CustomFields'
import PresetGrid from './PresetGrid'
import useSalon from './salon/panel'

type TProps = {
  shadow: TCoverShadow
}

export default function Panel({ shadow }: TProps) {
  const s = useSalon()

  return (
    <div className={s.panel}>
      <PresetGrid shadow={shadow} />
      <ColorModeGrid shadow={shadow} />
      <CustomFields shadow={shadow} showCustom={shadow.preset === COVER_SHADOW_PRESET.CUSTOM} />
    </div>
  )
}
