import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

export { cn } from '~/css'

type TProps = {
  color: TColorName
}

export default function useSalon({ color }: TProps) {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: 'column-align-both mt-10',
    layouts: 'row-center gap-x-7 gap-y-4 mb-3',
    card: cn('relative w-24 h-14 rounded-md border', rainbow(color, 'borderSoft')),
    cardInactive: 'saturate-0 opacity-45',
    title: cn('text-xs', fg('digest')),
    //
    logo: cn('absolute size-5 circle opacity-25', rainbow(color, 'bg')),
    bar: cn('absolute h-2 w-8 rounded-md opacity-35', rainbow(color, 'bg')),
  }
}
