import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, br, sexyHBorder } = useTwBelt()

  return {
    wrapper: cn('w-72 h-auto pl-12 mt-6 ml-14 border-l', br('divider')),
    block: 'mb-5',
    title: cn('text-sm bold-sm mb-2.5', fg('text.digest')),
    desc: cn('text-sm leading-loose', fg('text.digest')),
    divider: cn('my-7 -ml-1', sexyHBorder()),
  }
}
