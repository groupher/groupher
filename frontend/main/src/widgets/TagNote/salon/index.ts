import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, br } = useTwBelt()

  return {
    wrapper: cn('border-b pt-3.5 pb-4 mb-6 -mt-3', br('divider')),
    header: 'row-center mb-1.5 w-full',
    tagWrapper: cn('align-both -ml-0.5 h-6'),
    title: cn('text-base', fg('text.title')),
  }
}
