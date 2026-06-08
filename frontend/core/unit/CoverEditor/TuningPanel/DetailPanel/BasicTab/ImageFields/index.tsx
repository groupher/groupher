import AngleWheel from '~/widgets/AngleWheel'

import type { TTuningSetting } from '../../../../spec'
import useLogic from '../../../../useLogic'
import Controller from '../Border/Controller'
import ColorControl from '../Border/Controller/ColorControl'
import GlassFrameControl from '../Border/GlassFrameControl'
import MagnifierControl from '../Magnifier/Control'
import MagnifierSettings from '../Magnifier/Settings'
import Shadow, { ShadowSettings } from '../Shadow'
import useSalon from './salon'

type TProps = {
  setting: TTuningSetting
}

export default function ImageFields({ setting }: TProps) {
  const s = useSalon()
  const {
    glassBorderOnChange,
    magnifierOnChange,
    magnifierRadiationOnChange,
    magnifierZoomOnChange,
    rotateOnChange,
  } = useLogic()

  return (
    <div className={s.quickControls}>
      <div className={s.quickItem}>
        <div className={s.quickControl}>
          <Shadow
            position={setting.position}
            shadow={setting.shadow}
            size={setting.size}
            rotate={setting.rotate}
          />
        </div>
        <div className={s.quickLabelRow}>
          <span className={s.quickLabel}>Shadow</span>
          <span className={s.quickAction}>
            <ShadowSettings shadow={setting.shadow} />
          </span>
        </div>
      </div>

      <div className={s.quickItem}>
        <div className={s.quickControl}>
          <Controller borderHighlight={setting.borderHighlight} showColorControl={false} />
        </div>
        <div className={s.quickLabelRow}>
          <span className={s.quickLabel}>Border</span>
          <span className={s.quickAction}>
            <ColorControl borderHighlight={setting.borderHighlight} variant='setting' />
          </span>
        </div>
      </div>

      <div className={s.quickItem}>
        <div className={s.quickControl}>
          <MagnifierControl
            value={{
              center: setting.magnifierCenter,
              radius: setting.magnifierRadius,
              zoom: setting.magnifierZoom,
            }}
            label='Magnifier'
            disabled={!setting.hasMagnifier}
            onChange={(next) => {
              magnifierRadiationOnChange(next.center, next.radius)
              magnifierZoomOnChange(next.zoom)
            }}
            onToggle={() => magnifierOnChange(!setting.hasMagnifier)}
          />
        </div>
        <div className={s.quickLabelRow}>
          <span className={s.quickLabel}>Magnifier</span>
          <span className={s.quickAction}>
            <MagnifierSettings appearance={setting.magnifierAppearance} />
          </span>
        </div>
      </div>

      <div className={s.quickItem}>
        <div className={s.quickControl}>
          <GlassFrameControl
            enabled={setting.hasGlassBorder}
            onToggle={() => glassBorderOnChange(!setting.hasGlassBorder)}
          />
        </div>
        <div className={s.quickLabelRow}>
          <span className={s.quickLabel}>Frame</span>
        </div>
      </div>

      <div className={s.quickItem}>
        <div className={s.quickControl}>
          <AngleWheel value={setting.rotate} label='Angle' onChange={rotateOnChange} />
        </div>
        <div className={s.quickLabelRow}>
          <span className={s.quickLabel}>Angle</span>
        </div>
      </div>
    </div>
  )
}
