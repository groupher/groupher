import { COLOR } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: 'column p-5 pb-0 w-full min-h-52',
    body: 'grow mt-4',
    footer: 'column w-full mb-4 mt-5',
    desc: cn('text-sm ml-1', fg('digest')),
    warningTitle: cn('text-base bold-sm', rainbow(COLOR.BROWN, 'fg')),
    textarea: 'p-2.5 pl-3 rounded-md text-sm',
  }
}
