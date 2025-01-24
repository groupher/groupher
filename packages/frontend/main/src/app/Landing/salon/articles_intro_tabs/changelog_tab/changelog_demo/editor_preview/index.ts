import useTwBelt from '~/hooks/useTwBelt'

import { COLOR_NAME } from '~/const/colors'

export { cn } from '~/css'

export default () => {
  const { cn, br, fg, bg, shadow, rainbow } = useTwBelt()

  return {
    wrapper: cn(
      'column-align-center relative rounded-md px-6 pl-10 z-20 -ml-20 -mt-5 w-72 h-72 border',
      br('divider'),
      bg('htmlBg'),
      shadow('sm'),
    ),
    header: 'column w-48 mt-4 mb-2.5',
    title: cn('row-center bold-sm text-base', fg('text.digest')),
    version: cn('text-sm ml-2', fg('text.hint')),
    tags: cn('row-center mt-0.5 gap-x-2', fg('text.digest')),
    tagItem: 'row-center text-xs',
    //
    cover: cn(
      'relative w-44 h-24 overflow-hidden rounded mb-1.5',
      rainbow(COLOR_NAME.RED, 'bgSoft'),
    ),
    content: 'column mt-12 w-48 gap-2.5',
    bar: cn('w-40 h-1.5 rounded-md opacity-30', bg('text.digest')),
  }
}
