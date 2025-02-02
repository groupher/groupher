import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  small: boolean
}

export default ({ small }: TProps) => {
  const { cn, fill } = useTwBelt()

  return {
    icon: cn(
      'mr-1.5 opacity-60 transition-colors',
      small ? 'size-3' : 'size-3.5',
      `group-hover:${fill('text.title')}`,
      fill('text.digest'),
    ),
    active: cn('opacity-80', fill('text.title')),
  }
}
