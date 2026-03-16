import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

type TProps = {
  color: TColorName
}

export default function useSalon({ color }: TProps) {
  const { cn, fg, br, rainbow } = useTwBelt()

  return {
    wrapper: cn('row-center w-7/12 min-h-20 py-8 border-b last:border-b-0', br('divider')),
    cover: 'column mr-12',
    iconBox: cn('align-both size-12 -mt-8 rounded-lg', rainbow(color, 'bgSoft')),
    content: 'column grow',
    //
    title: cn('text-base', fg('title')),
    desc: cn('text-sm line-clamp-2 mt-1.5', fg('digest')),
    footer: 'row-between w-full mt-4',
    authorHint: cn('text-xs', fg('hint')),
    moreLink: 'mt-1 scale-90',
  }
}
