import useTwBelt from '~/hooks/useTwBelt'

import useWidgets from '../../logic/useWidgets'

export { cn } from '~/css'

export default () => {
  const { cn, rainbow, fg, shadow } = useTwBelt()

  const { widgetsPrimaryColor } = useWidgets()

  return {
    wrapper: cn('column'),
    label: cn(
      'align-both size-7 circle pointer -ml-0.5 border',
      rainbow(widgetsPrimaryColor, 'border'),
    ),

    theColor: cn('size-5 circle', rainbow(widgetsPrimaryColor, 'bg')),
    threads: cn('row wrap justify-between px-4 py-3.5 rounded-md', shadow('lg')),
    section: 'w-5/12 my-2.5 px-2',
    header: 'row-center w-full',
    threadTitle: cn('text-sm', fg('text.title')),
    desc: cn('mt-1 text-sm opacity-80 w-9/12', fg('text.digest')),
  }
}
