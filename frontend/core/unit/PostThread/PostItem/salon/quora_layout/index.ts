import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

type TProps = {
  active?: boolean
}

export default function useSalon({ active = false }: TProps = {}) {
  const { cn, fg } = useTwBelt()
  const { hoverEffect } = useBase({ active })

  return {
    wrapper: cn(hoverEffect, 'column grow'),
    digest: cn('text-sm mt-1.5 mb-3 w-11/12 truncate', fg('digest')),
  }
}
