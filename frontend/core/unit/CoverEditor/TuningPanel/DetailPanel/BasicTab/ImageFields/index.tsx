import AngleWheel from '~/widgets/AngleWheel'
import RadiationControl from '~/widgets/RadiationControl'

import type { TTuningSetting } from '../../../../spec'
import useLogic from '../../../../useLogic'
import Controller from '../Border/Controller'
import GlassFrameControl from '../Border/GlassFrameControl'
import Corner from '../Corner'
import PositionController from '../Position/Controller'
import Shadow from '../Shadow'
import Size from '../Size'
import useSalon from './salon'

type TProps = {
  setting: TTuningSetting
}

export default function ImageFields({ setting }: TProps) {
  const s = useSalon()
  const {
    glassBorderOnChange,
    lightOnChange,
    lightRadiationOnChange,
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
            <RadiationControl
              value={{ center: setting.lightCenter, radius: setting.lightRadius }}
              label='Lighting'
              disabled={!setting.hasLight}
              onChange={(next) => lightRadiationOnChange(next.center, next.radius)}
              onToggle={() => lightOnChange(!setting.hasLight)}
            />
          </div>
          <div className={s.quickLabel}>Lighting</div>
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
          <Size size={setting.size} />
        </div>
        <div className={s.fineColumn}>
          <Shadow shadow={setting.shadow} />
          <Corner borderRadius={setting.borderRadius} />
        </div>
      </div>
    </>
  )
}
