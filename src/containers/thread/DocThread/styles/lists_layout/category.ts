import type { TColorName } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  color: TColorName
}

export default ({ color }: TProps) => {
  const { cn, fg, br, rainbow } = useTwBelt()

  return {
    wrapper: cn('row-center w-7/12 min-h-20 py-8 border-b last:border-b-0', br('divider')),
    cover: cn('column mr-12'),
    iconBox: cn('align-both size-12 -mt-8 rounded-lg', rainbow(color, 'bgSoft')),
    content: 'column grow',
    //
    title: cn('text-base', fg('text.title')),
    desc: cn('text-sm line-clamp-2 mt-1.5', fg('text.digest')),
    footer: cn('row-center-between w-full mt-4'),
    authorHint: cn('text-xs', fg('text.hint')),
    moreLink: 'mt-1 scale-90',
  }
}
