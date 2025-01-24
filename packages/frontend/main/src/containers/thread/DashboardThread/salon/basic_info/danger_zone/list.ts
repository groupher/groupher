import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, fg, margin } = useTwBelt()

  return {
    wrapper: cn('column w-full', margin(spacing)),
    item: cn('text-sm list-disc mb-1', fg('text.title')),
  }
}
