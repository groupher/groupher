import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'pb-8 mb-5',
    label: cn('font-sm', fg('text.title')),
    input: 'mt-2.5 mb-5 w-full',
    enableDesc: cn('row-center w-full leading-relaxed'),
    selectWrapper: 'mt-2.5 mb-5 w-full',
  }
}
