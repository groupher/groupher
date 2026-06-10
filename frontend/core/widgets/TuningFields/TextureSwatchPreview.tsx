import useTwBelt from '~/hooks/useTwBelt'
import { WALLPAPER_TEXTURE } from '~/lib/wallpaperMesh'
import type { TImageTextureType } from '~/lib/wallpaperMesh'

import useSalon from './salon/texture_swatch_preview'
import { TILE_ROWS, DOTS, NOISE_DOTS, ASCII_ROWS, OIL_PATCHES } from './texture_constant'

type Props = {
  type: TImageTextureType
  variant?: 'picker' | 'hud'
}

export default function TextureSwatchPreview({ type, variant = 'picker' }: Props) {
  const { cn } = useTwBelt()
  const s = useSalon()

  return (
    <div className={cn(s.wrapper, s[variant])}>
      {type === WALLPAPER_TEXTURE.TILE && (
        <div className='column size-full justify-center gap-px p-px'>
          {TILE_ROWS.map((row) => (
            <div key={row.join('-')} className='grid grid-cols-4 gap-px'>
              {row.map((id) => (
                <span key={id} className={s.tile} />
              ))}
            </div>
          ))}
        </div>
      )}

      {type === WALLPAPER_TEXTURE.BEAM && (
        <div className='flex size-full justify-center gap-1 px-1'>
          <span className={s.beam} />
          <span className={s.beam} />
          <span className={s.beam} />
        </div>
      )}

      {type === WALLPAPER_TEXTURE.ASCII && (
        <div className='column-align-both size-full gap-0.5 p-1 font-mono text-xs leading-none'>
          {ASCII_ROWS.map((row) => (
            <div key={row.map(({ id }) => id).join('-')} className='row-center h-1.5'>
              {row.map(({ id, char }) => (
                <span key={id} className='block scale-50 leading-none'>
                  {char}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {type === WALLPAPER_TEXTURE.DOTS && (
        <div className='grid size-full grid-cols-3 place-items-center p-1'>
          {DOTS.map((id) => (
            <span key={id} className={s.dot} />
          ))}
        </div>
      )}

      {type === WALLPAPER_TEXTURE.NOISE && (
        <div className='relative size-full'>
          {NOISE_DOTS.map(({ id, className }) => (
            <span key={id} className={cn(s.noiseDot, className)} />
          ))}
        </div>
      )}

      {type === WALLPAPER_TEXTURE.OIL && (
        <div className='relative size-full'>
          {OIL_PATCHES.map((className, index) => (
            <span
              key={className}
              className={cn(s.oilPatch, className, index % 2 && 'opacity-65')}
            />
          ))}
        </div>
      )}
    </div>
  )
}
