import useTrans from '~/hooks/useTrans'
import { WALLPAPER_TEXTURE_OPTIONS } from '~/lib/wallpaperMesh'
import type { TImageTextureType } from '~/lib/wallpaperMesh'
import Tooltip from '~/widgets/Tooltip'

import useSalon, { cn } from '../salon/texture_style_picker'
import TextureSwatchPreview from './TextureSwatchPreview'

type Props = {
  value: TImageTextureType
  active?: boolean
  showLabel?: boolean
  onChange: (type: TImageTextureType) => void
}

export default function TextureStylePicker({
  value,
  active = true,
  showLabel = true,
  onChange,
}: Props) {
  const { t } = useTrans()
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {showLabel && <div className={s.label}>{t('dsb.appearance.wallpaper.texture.style')}</div>}
      <div className={s.options}>
        {WALLPAPER_TEXTURE_OPTIONS.map(({ type, labelKey }) => {
          const selected = active && value === type
          const label = t(labelKey)

          return (
            <Tooltip key={type} content={label} placement='top'>
              <button
                type='button'
                className={cn(s.swatch, selected ? s.swatchActive : s.swatchIdle)}
                aria-label={label}
                onClick={() => onChange(type)}
              >
                <TextureSwatchPreview type={type} variant='picker' />
              </button>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}
