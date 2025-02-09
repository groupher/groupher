import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {} & TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, margin, fg, global, fill } = useTwBelt()

  return {
    wrapper: cn('row-center', margin(spacing)),
    highlightWrapper: cn(global('count-highlight')),
    count: cn('text-sm bold', fg('text.digest')),
    icon: cn('mr-1 mt-px size-3 opacity-65', fill('text.digest')),
    iconHighlight: fill('heightIcon'),
  }
}
