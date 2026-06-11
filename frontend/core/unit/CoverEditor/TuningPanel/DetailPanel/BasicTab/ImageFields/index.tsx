import AngleWheel from '~/widgets/AngleWheel'

import { useImageDraftContext } from '../../../../imageDraftContext'
import type { TCoverImageConfig } from '../../../../spec'
import useLogic from '../../../../useLogic'
import Controller from '../Border/Controller'
import ColorControl from '../Border/Controller/ColorControl'
import GlassFrameControl from '../Border/GlassFrameControl'
import MagnifierControl from '../Magnifier/Control'
import MagnifierSettings from '../Magnifier/Settings'
import Shadow, { ShadowSettings } from '../Shadow'
import useSalon from './salon'

type TProps = {
  image: TCoverImageConfig
}

export default function ImageFields({ image }: TProps) {
  const s = useSalon()
  const { glassBorderOnChange, magnifierOnChange } = useLogic()
  const { flushImageDraft, scheduleImagePatch } = useImageDraftContext()

  return (
    <div className={s.quickControls}>
      <div className={s.quickItem}>
        <div className={s.quickControl}>
          <Shadow
            imageDominantColor={image.dominantColor}
            position={image.position}
            shadow={image.shadow}
            size={image.size}
            rotate={image.rotate}
          />
        </div>
        <div className={s.quickLabelRow}>
          <span className={s.quickLabel}>Shadow</span>
          <span className={s.quickAction}>
            <ShadowSettings shadow={image.shadow} which={image.which} />
          </span>
        </div>
      </div>

      <div className={s.quickItem}>
        <div className={s.quickControl}>
          <Controller
            borderHighlight={image.borderHighlight}
            showColorControl={false}
            which={image.which}
          />
        </div>
        <div className={s.quickLabelRow}>
          <span className={s.quickLabel}>Border</span>
          <span className={s.quickAction}>
            <ColorControl
              borderHighlight={image.borderHighlight}
              variant='setting'
              which={image.which}
            />
          </span>
        </div>
      </div>

      <div className={s.quickItem}>
        <div className={s.quickControl}>
          <MagnifierControl
            value={{
              center: image.magnifier.center,
              radius: image.magnifier.radius,
              zoom: image.magnifier.zoom,
            }}
            label='Magnifier'
            disabled={!image.magnifier.enabled}
            onChange={(next) => {
              scheduleImagePatch(image.which, {
                magnifier: {
                  center: next.center,
                  radius: next.radius,
                  zoom: next.zoom,
                  enabled: true,
                },
              })
            }}
            onToggle={() => magnifierOnChange(image.which, !image.magnifier.enabled)}
            onCommit={flushImageDraft}
          />
        </div>
        <div className={s.quickLabelRow}>
          <span className={s.quickLabel}>Magnifier</span>
          <span className={s.quickAction}>
            <MagnifierSettings magnifier={image.magnifier} which={image.which} />
          </span>
        </div>
      </div>

      <div className={s.quickItem}>
        <div className={s.quickControl}>
          <GlassFrameControl
            enabled={image.glassBorder.enabled}
            onToggle={() => glassBorderOnChange(image.which, !image.glassBorder.enabled)}
          />
        </div>
        <div className={s.quickLabelRow}>
          <span className={s.quickLabel}>Frame</span>
        </div>
      </div>

      <div className={s.quickItem}>
        <div className={s.quickControl}>
          <AngleWheel
            value={image.rotate}
            label='Angle'
            onChange={(rotate) => scheduleImagePatch(image.which, { rotate })}
            onCommit={flushImageDraft}
          />
        </div>
        <div className={s.quickLabelRow}>
          <span className={s.quickLabel}>Angle</span>
        </div>
      </div>
    </div>
  )
}
