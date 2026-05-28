import useTrans from '~/hooks/useTrans'
import { WALLPAPER_TEXTURE_OPTIONS } from '~/lib/wallpaperMesh'
import type { TImageTextureType } from '~/lib/wallpaperMesh'
import Tooltip from '~/widgets/Tooltip'

import useSalon, { cn } from '../salon/texture_style_picker'
import TextureSwatchPreview from './TextureSwatchPreview'

type Props = {
  value: TImageTextureType
  onChange: (type: TImageTextureType) => void
}

export default function TextureStylePicker({ value, onChange }: Props) {
  const { t } = useTrans()
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.label}>{t('dsb.appearance.wallpaper.texture.style')}</div>
      <div className={s.options}>
        {WALLPAPER_TEXTURE_OPTIONS.map(({ type, labelKey }) => {
          const selected = value === type
          const label = t(labelKey)

          return (
            <Tooltip key={type} content={label} placement='top'>
              <button
                type='button'
                className={cn(s.swatch, selected ? s.swatchActive : s.swatchIdle)}
                aria-label={label}
                onClick={() => onChange(type)}
              >
                <TextureSwatchPreview type={type} className={s.swatchPreview} />
              </button>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}
