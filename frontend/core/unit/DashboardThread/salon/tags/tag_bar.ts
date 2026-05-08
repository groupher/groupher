import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

export { cn } from '~/css'

type TProps = {
  color: TColorName | null
  editing?: boolean
}

export default function useSalon({ color, editing = false }: TProps) {
  const { cn, br, fg, rainbow, hover } = useTwBelt()

  return {
    wrapper: cn(
      'row-center group w-full h-10 p-2.5 pr-1 border rounded-md mb-3',
      br('divider'),
      hover('box'),
    ),
    wrapperEdit: '!block !w-full !h-11 !p-0 !border-0',
    dotSelector: cn(
      'align-both size-7 circle border-2 p-0.5 mr-1 pointer',
      editing ? 'ml-2 mr-2' : '-ml-1.5',
      br('divider'),
    ),
    title: cn('row-center text-sm ml-1', fg('title')),
    slug: cn('text-xs ml-3', fg('hint')),
    catNote: cn('text-xs ml-3', fg('hint')),
    input: 'h-8',
    dot: cn('size-5 circle', color && rainbow(color, 'bg')),
  }
}
