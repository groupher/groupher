import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  minimal: boolean
  width: string
} & TSpace

export default ({ minimal, width, ...spacing }: TProps) => {
  const { cn, margin, fg, fill } = useTwBelt()

  return {
    wrapper: cn(
      'row-center h-11 py-2.5 pr-2 rounded-lg mr-3',
      width,
      minimal && 'h-8 py-2 mr-0',
      margin(spacing),
    ),
    hint: cn('ml-0.5', fg('text.title')),
    hintText: cn(minimal ? 'text-xs' : 'text-sm', fg('text.title')),
    infoIcon: cn('size-4 mr-2', fill('text.digest')),
    actions: cn('row-center', minimal && 'scale-90 -mr-2'),
  }
}
