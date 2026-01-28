import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, fg, bg, fill, margin } = useTwBelt()

  return {
    wrapper: cn(
      'row items-start pl-3.5 pr-4 pt-2 pb-1.5 min-h-9 rounded-md',
      fg('title'),
      bg('notice.bg'),
      margin(spacing),
    ),
    noBg: cn('pl-1 bg-transparent', fg('digest')),
    main: 'grow text-sm mt-px w-full leading-7',
    userName: cn('mr-1.5', fg('title')),
    authorTag: cn('ml-0.5 mr-1', fg('digest')),
    timestamp: cn('text-xs', fg('digest')),
    questionIcon: cn('size-4 ml-2.5 -mt-px pointer', fill('digest'), `hover:${fill('title')}`),
  }
}
