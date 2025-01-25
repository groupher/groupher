import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, fg, fill, margin } = useTwBelt()

  return {
    wrapper: cn('items-center', margin(spacing)),
    popHint: cn('text-xs px-2.5 py-1', fg('text.title')),
    sourceLink: cn('text-xs line-clamp-1 break-all no-underline hover:underline', fg('link')),
    plainColor: fg('link'),
    //
    linkIcon: cn('size-4 mt-0.5 mr-1', fill('text.digest')),
  }
}
