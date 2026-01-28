import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('row-center h-full', fg('title')),
    qrCode: 'w-40',
    desc: cn('text-sm', fg('digest')),
    descTitle: cn('text-base mb-2.5', fg('title')),
  }
}
