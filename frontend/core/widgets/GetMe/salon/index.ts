import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, hover } = useTwBelt()

  return {
    wrapper: cn(
      'size-6 align-both rounded',
      'hover:cursor-pointer',
      /* to aoid pointer status like hover conflict */
      // '[&_svg]:pointer-events-none',
      hover('bg'),
    ),
    downloadIcon: cn('size-4 -mr-px', hover('icon')),
  }
}
