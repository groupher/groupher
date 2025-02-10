import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, rainbow, fg, bg, fill, br } = useTwBelt()

  return {
    wrapper: cn(
      'column w-full border border-dashed rounded-2xl',
      rainbow(COLOR_NAME.RED, 'borderSoft'),
      bg('sandBox'),
    ),
    dangerTitle: cn('text-base bold-sm mb-3.5 mt-3.5 ml-4', rainbow(COLOR_NAME.RED, 'fg')),
    item: cn('column items-start w-full py-6 px-4 border', br('divider'), bg('htmlBg')),
    title: cn('row-center w-full text-sm mb-2.5', fg('text.title')),
    desc: cn('text-sm opacity-80', fg('text.digest')),
    icon: cn('size-4 ml-1 pointer', `hover: ${fill('text.title')}`, fill('text.digest')),
  }
}
