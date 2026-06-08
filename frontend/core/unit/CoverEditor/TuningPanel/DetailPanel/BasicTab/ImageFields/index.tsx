import AngleWheel from '~/widgets/AngleWheel'

import type { TTuningSetting } from '../../../../spec'
import useLogic from '../../../../useLogic'
import Controller from '../Border/Controller'
import GlassFrameControl from '../Border/GlassFrameControl'
import MagnifierControl from '../Magnifier/Control'
import PositionController from '../Position/Controller'
import Shadow from '../Shadow'
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
    positionOnChange,
    rotateOnChange,
  } = useLogic()

  return (
    <>
      <div className={s.quickControls}>
        <div className={s.quickItem}>
          <div className={s.quickControl}>
            <PositionController
              position={setting.position}
              size={setting.size}
              rotate={setting.rotate}
              onChange={positionOnChange}
            />
          </div>
          <div className={s.quickLabel}>Position</div>
        </div>

        <div className={s.quickItem}>
          <div className={s.quickControl}>
            <Controller borderHighlight={setting.borderHighlight} />
          </div>
          <div className={s.quickLabel}>Border</div>
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
          <div className={s.quickLabel}>Magnifier</div>
        </div>

        <div className={s.quickItem}>
          <div className={s.quickControl}>
            <GlassFrameControl
              enabled={setting.hasGlassBorder}
              onToggle={() => glassBorderOnChange(!setting.hasGlassBorder)}
            />
          </div>
          <div className={s.quickLabel}>Frame</div>
        </div>

        <div className={s.quickItem}>
          <div className={s.quickControl}>
            <AngleWheel value={setting.rotate} label='Angle' onChange={rotateOnChange} />
          </div>
          <div className={s.quickLabel}>Angle</div>
        </div>
      </div>

      <div className={s.fineSettings}>
        <div className={s.fineColumn}>
          <Shadow shadow={setting.shadow} />
        </div>
      </div>
    </>
  )
}
