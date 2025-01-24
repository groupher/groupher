import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {} & TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, margin, fg, bg, global, fill } = useTwBelt()

  return {
    wrapper: cn('row-center w-full wrap min-h-8 gap-x-3 gap-y-2.5 mb-3 -mt-1', margin(spacing)),
    highlightWrapper: cn(global('count-highlight')),
    count: cn('text-sm bold', fg('text.digest')),
    iconBox: cn('align-both size-6 rounded pointer group', `hover:${bg('hoverBg')}`),
    icon: cn(
      'size-4 saturate-0 group-hover:saturate-100',
      fill('text.digest'),
      `group-hover:${fill('text.title')}`,
    ),
  }
}
