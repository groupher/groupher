import useTwBelt from '~/hooks/useTwBelt'

import useBase from '.'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, cut, fg } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn(base.template, 'row-center h-16 justify-between px-7 pr-8'),
    active: base.templateActive,
    center: 'row-center gap-x-5',
    right: 'row-center gap-x-4',
    linkItem: cn('text-xs no-underline hover:underline pointer', cut('w-12'), fg('digest')),
  }
}
