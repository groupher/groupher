import useInlineTagSalon from '~/hooks/useInlineTagSalon'
import useTwBelt from '~/hooks/useTwBelt'
import type { TColor } from '~/spec'

type TProps = TColor

export default function useSalon({ color }: TProps) {
  const { cn, fg } = useTwBelt()
  const inlineTagSalon = useInlineTagSalon({ color })

  return {
    wrapper: inlineTagSalon.wrapper,
    // wrapper: cn('row-center rounded-sm px-1', rainbow(color, 'bg')),
    popover: 'column m-1 gap-y-1',
    // title: cn('text-xs keep-all mr-px', fg('digest')),
    title: inlineTagSalon.title,
    more: cn('text-xs italic opacity-80', fg('digest')),
  }
}
