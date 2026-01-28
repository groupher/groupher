import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = {} & TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, margin, fg, fill } = useTwBelt()

  return {
    wrapper: cn('row-center', margin(spacing)),
    highlightWrapper: 'count-highlight',
    count: cn('text-sm bold', fg('digest')),
    icon: cn('mr-1 mt-px size-3 opacity-65', fill('digest')),
    iconHighlight: fill('highlight'),
  }
}
