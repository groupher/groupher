import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, br, rainbow, shadow } = useTwBelt()

  return {
    wrapper: cn('row-center w-full h-full overflow-hidden px-4 trans-all-200'),
    phone: cn(
      'column w-28 min-w-28 h-44 pl-2.5 border-4 rounded-t-xl mt-2 gap-y-1.5',
      bg('htmlBg'),
      shadow('sm'),
      br('text.digest'),
    ),
    brand: cn('row-center mt-2 mb-3.5 text-xs scale-90 -ml-1', fg('text.digest')),
    logo: cn('size-3.5 rounded opacity-40 mr-1.5', rainbow(COLOR_NAME.ORANGE, 'bg')),
    item: 'row-center mb-0.5',
    avtrar: 'size-3.5 rounded mt-0.5',
    post: 'column ml-2.5 gap-y-1 mt-1',
    bar: cn('w-10 h-1 opacity-30 rounded-xl', bg('text.digest')),
  }
}
