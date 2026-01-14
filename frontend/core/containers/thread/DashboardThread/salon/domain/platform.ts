import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('column'),
    title: cn('text-base mb-1', fg('text.title')),
    desc: cn('text-sm/6', fg('text.digest')),
    inputWrapper: 'row-center my-4 mb-6',
    domainText: cn('text-base ml-1', fg('text.title')),
    domainSlug: cn('text-base mx-0.5', fg('text.digest')),
  }
}
