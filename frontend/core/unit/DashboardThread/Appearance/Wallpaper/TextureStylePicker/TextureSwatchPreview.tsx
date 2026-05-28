import useTwBelt from '~/hooks/useTwBelt'
import { WALLPAPER_TEXTURE } from '~/lib/wallpaperMesh'
import type { TImageTextureType } from '~/lib/wallpaperMesh'

type Props = {
  type: TImageTextureType
  className?: string
}

const TILE_ROWS = [
  ['a1', 'a2', 'a3', 'a4'],
  ['b1', 'b2', 'b3', 'b4'],
  ['c1', 'c2', 'c3', 'c4'],
  ['d1', 'd2', 'd3', 'd4'],
  ['e1', 'e2', 'e3', 'e4'],
]
const DOTS = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br']
const NOISE_DOTS = [
  { id: 'n1', className: 'left-1 top-1 size-0.5' },
  { id: 'n2', className: 'left-3 top-0.5 size-1' },
  { id: 'n3', className: 'right-1.5 top-2 size-0.5' },
  { id: 'n4', className: 'left-2 top-2.5 size-1' },
  { id: 'n4b', className: 'left-4 top-2.5 size-0.5' },
  { id: 'n5', className: 'right-2.5 top-3.5 size-0.5' },
  { id: 'n6', className: 'left-1 top-4 size-0.5' },
  { id: 'n7', className: 'left-3.5 top-4.5 size-1' },
  { id: 'n8', className: 'right-1.5 top-5 size-0.5' },
  { id: 'n8b', className: 'left-2.5 top-5.5 size-0.5' },
  { id: 'n9', className: 'left-1.5 bottom-2 size-1' },
  { id: 'n10', className: 'left-3 bottom-1 size-0.5' },
  { id: 'n11', className: 'right-3 bottom-2.5 size-0.5' },
  { id: 'n12', className: 'right-1 bottom-1.5 size-1' },
  { id: 'n13', className: 'left-4.5 bottom-3 size-0.5' },
  { id: 'n14', className: 'right-4 bottom-1 size-0.5' },
]
const ASCII_ROWS = [
  [
    { id: 'a1', char: 'J' },
    { id: 'a2', char: '8' },
    { id: 'a3', char: '#' },
  ],
  [
    { id: 'b1', char: 'x' },
    { id: 'b2', char: 'Y' },
    { id: 'b3', char: '*' },
  ],
  [
    { id: 'c1', char: '#' },
    { id: 'c2', char: '8' },
    { id: 'c3', char: 'X' },
  ],
]

export default function TextureSwatchPreview({ type, className = '' }: Props) {
  const { cn, bg, fg } = useTwBelt()
  const noiseDotClass = cn('absolute rounded-full opacity-80', bg('digest'))
  const tileClass = cn('h-1.5 rounded-none shadow-sm', bg('digest'))
  const dotClass = cn('size-0.5 rounded-full shadow-sm', bg('digest'))

  return (
    <div className={cn(className, bg('card'), fg('title'))}>
      {type === WALLPAPER_TEXTURE.TILE && (
        <div className='column size-full justify-center gap-px p-px'>
          {TILE_ROWS.map((row) => (
            <div key={row.join('-')} className='grid grid-cols-4 gap-px'>
              {row.map((id) => (
                <span key={id} className={tileClass} />
              ))}
            </div>
          ))}
        </div>
      )}

      {type === WALLPAPER_TEXTURE.BEAM && (
        <div className='flex size-full justify-center gap-1 px-1'>
          <span className={cn('h-full w-1', bg('digest'))} />
          <span className={cn('h-full w-1', bg('digest'))} />
          <span className={cn('h-full w-1', bg('digest'))} />
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
            <span key={id} className={dotClass} />
          ))}
        </div>
      )}

      {type === WALLPAPER_TEXTURE.NOISE && (
        <div className='relative size-full'>
          {NOISE_DOTS.map(({ id, className }) => (
            <span key={id} className={cn(noiseDotClass, className)} />
          ))}
        </div>
      )}
    </div>
  )
}
