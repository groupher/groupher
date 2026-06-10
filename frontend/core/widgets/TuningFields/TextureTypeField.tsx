import type { ReactNode } from 'react'

import useTrans from '~/hooks/useTrans'
import { WALLPAPER_TEXTURE_OPTIONS } from '~/lib/wallpaperMesh'
import type { TImageTextureType } from '~/lib/wallpaperMesh'
import Tooltip from '~/widgets/Tooltip'

import { cn } from './salon/texture_type_field'
import useSalon from './salon/texture_type_field'
import TextureSwatchPreview from './TextureSwatchPreview'

type Props = {
  label?: ReactNode
  value: TImageTextureType
  active?: boolean
  onChange: (type: TImageTextureType) => void
}

export default function TextureTypeField({ label, value, active = true, onChange }: Props) {
  const { t } = useTrans()
  const s = useSalon()
  const fieldLabel = label ?? t('dsb.appearance.wallpaper.editor.type')

  return (
    <div className={s.wrapper}>
      <div className={s.label}>{fieldLabel}</div>
      <div className={s.content}>
        <div className={s.options}>
          {WALLPAPER_TEXTURE_OPTIONS.map(({ type, labelKey }) => {
            const selected = active && value === type
            const optionLabel = t(labelKey)

            return (
              <Tooltip key={type} content={optionLabel} placement='top'>
                <button
                  type='button'
                  className={cn(s.swatch, selected ? s.swatchActive : s.swatchIdle)}
                  aria-label={optionLabel}
                  aria-pressed={selected}
                  onClick={() => onChange(type)}
                >
                  <TextureSwatchPreview type={type} variant='picker' />
                </button>
              </Tooltip>
            )
          })}
        </div>
      </div>
    </div>
  )
}
