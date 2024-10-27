import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: cn('column-center w-full h-44 mt-16'),
    title: cn('text-xl bold-sm mt-1', rainbow(COLOR_NAME.BLUE, 'fg')),
    digest: cn('text-lg leading-relaxed mb-8', fg('text.digest')),
    highlight: cn(
      'bold-sm italic ml-px mr-px px-0.5',
      rainbow(COLOR_NAME.BLUE, 'fg'),
      rainbow(COLOR_NAME.BLUE, 'bgSoft'),
    ),
    //
    features: 'row wrap ml-20',
    featItem: 'w-4/12 mb-3.5',
  }
}
