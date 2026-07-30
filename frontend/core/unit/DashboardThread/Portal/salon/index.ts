import useTwBelt from '~/hooks/useTwBelt'

import { DSB_DOC } from '../../constant'

export default function useSalon({ ...spacing }) {
  const { cn, fg, bg, margin } = useTwBelt()

  return {
    wrapper: cn('column w-full', margin(spacing)),
    breadcrumbRow: cn('flex flex-row items-start justify-between w-full', DSB_DOC.HEADER_ROW),
    breadcrumbs: 'row-center',
    addon: 'absolute right-0 top-1/2 -translate-y-1/2',
    body: 'relative w-full',
    header: 'row-between w-full',
    title: cn('text-2xl w-auto', fg('title')),
    desc: cn('text-sm mt-2.5 mb-2', fg('digest')),
    divider: cn('w-full h-px mt-5 mb-8', bg('divider')),
  }
}
