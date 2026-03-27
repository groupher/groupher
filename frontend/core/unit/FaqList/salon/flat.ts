import { COLOR } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  large: boolean
}

export default function useSalon({ large }: TProps) {
  const { cn, fg, cut, rainbow } = useTwBelt()

  return {
    wrapper: 'column w-full min-w-80',
    header: cn('align-both', large ? 'mb-16' : 'mb-14'),
    brandText: cn('bold-sm', fg('title'), large ? 'text-2xl' : 'text-xl'),
    //
    content: cn('row justify-between wrap', large ? 'gap-y-10' : 'gap-y-12'),
    section: cn('line-clamp-2 w-64', fg('title'), large ? 'text-lg' : 'text-base'),
    title: cn('bold-sm', cut('w-60'), fg('title'), large ? 'text-lg' : 'text-base'),
    checkBox: cn('size-5', large ? 'mr-4' : 'mr-2.5'),
    checkIcon: cn('size-4', large && 'scale-110', rainbow(COLOR.GREEN, 'fill')),
    //
    body: cn('line-clamp-3 mt-4', fg('digest'), large ? 'pl-8' : 'pl-6'),
  }
}
