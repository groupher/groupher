import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'w-full pb-8 mb-5',
    label: cn('text-sm ml-1', fg('text.title')),
    hint: cn('text-xs ml-1 mb-6 break-all opacity-65', fg('text.digest')),
    input: 'mt-2.5 mb-2.5 w-full',
  }
}
