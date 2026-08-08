import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  small: boolean
}

export default function useSalon({ small }: TProps) {
  const { cn, fill, hover } = useTwBelt()

  return {
    icon: cn('mr-1.5 opacity-60 transition-colors', small ? 'size-3' : 'size-3.5', hover('icon')),
    active: cn('opacity-80', fill('title')),
  }
}
