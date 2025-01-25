import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, hoverable } = useTwBelt()

  return {
    wrapper: cn(
      'size-6 align-both rounded',
      'hover:cursor-pointer',
      /* to aoid pointer status like hover conflict */
      // '[&_svg]:pointer-events-none',
      hoverable('bg'),
    ),
    downloadIcon: cn('size-4 -mr-px', hoverable('icon')),
  }
}
