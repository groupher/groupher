import useTwBelt from '~/hooks/useTwBelt'

import useBase from './'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, fill } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn(base.template, 'row-between px-5'),
    active: base.templateActive,
    left: 'row-center gap-x-2.5',
    right: 'row-center gap-x-6',
    linkItem: cn('text-xs pointer trans-all-100', `hover:${fg('title')}`, fg('digest')),
    accountIcon: cn('size-3 -mt-0.5', fill('digest')),
  }
}
