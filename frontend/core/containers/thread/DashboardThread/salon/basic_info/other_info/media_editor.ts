import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'w-full',

    hint: cn('font-sm opacity-80 mt-1.5 ml-0.5', fg('text.digest')),
    label: cn('row-center text-sm bold-sm mb-4', fg('text.digest')),
  }
}
