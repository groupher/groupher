import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

type TProps = {
  color: TColorName
}

export default function useSalon({ color }: TProps) {
  const { cn, fg, br, bg, rainbow } = useTwBelt()

  return {
    wrapper: cn(
      'column h-full rounded-lg border px-6 py-6 text-left',
      bg('card'),
      br('divider'),
      `hover:${rainbow(color, 'borderSoft')}`,
    ),
    iconBox: cn('align-both mb-2 size-6 opacity-50', rainbow(color, 'bgSoft')),
    title: cn('text-lg bold-sm leading-9', fg('title')),
    desc: cn('grow text-sm leading-6 line-clamp-2', fg('digest')),
    footer: 'row-between mt-6',
    count: cn('text-sm', fg('hint')),
  }
}
