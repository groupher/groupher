import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

export { cn } from '~/css'

type TProps = {
  color: TColorName | null
  editing?: boolean
}

export default function useSalon({ color, editing = false }: TProps) {
  const { cn, br, fg, rainbow, hover, bg, cut } = useTwBelt()

  return {
    wrapper: cn(
      'row-center group w-full h-10 p-2.5 pr-1 border rounded-md mb-3',
      br('divider'),
      hover('box'),
    ),
    wrapperEdit: '!block !w-full !h-11 !p-0 !border-0',
    styleControls: 'row-center ml-2 mr-2 gap-1.5',
    iconPicker: cn('align-both size-7 rounded-md border', br('divider'), bg('card')),
    dotSelector: cn(
      'align-both size-7 rounded-md border p-1 pointer',
      editing ? '' : '-ml-1.5 mr-1',
      br('divider'),
      bg('card'),
    ),
    info: 'row-center min-w-0 gap-x-2',
    title: cn('text-sm shrink-0', fg('title'), cut('w-16')),
    slug: cn('text-xs shrink-0', fg('hint'), cut('w-16')),
    desc: cn('text-xs min-w-0', fg('hint'), cut('w-32')),
    dotSep: cn('size-0.5 shrink-0 circle', bg('dot')),
    catNote: cn('text-xs ml-3', fg('hint')),
    input: 'h-8',
    dot: cn('h-full w-full rounded', color && rainbow(color, 'bg')),
  }
}
