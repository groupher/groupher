import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fill, primary } = useTwBelt()

  return {
    wrapper: 'row-center size-4 opacity-60',
    icon: cn('size-3', fill('text.digest')),
    iconActive: cn(primary('fill')),
  }
}
