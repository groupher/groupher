import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, bg, global, shadow, rainbow } = useTwBelt()

  return {
    wrapper: cn(
      'column p-1.5 rounded-2xl w-[440px] h-[360px] absolute top-40 left-5',
      bg('htmlBg'),
      shadow('sm'),
    ),
    inner: cn('w-full h-full rounded-xl relative', global('gradient-red')),
    bar: cn(
      'w-12 h-1.5 -ml-6 rounded-xl absolute top-4 left-1/2 opacity-15',
      rainbow(COLOR_NAME.RED, 'bg'),
    ),
    printIcon: cn('size-16 opacity-10 absolute right-2 top-2', rainbow(COLOR_NAME.RED, 'fill')),
  }
}
