import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, br, primary } = useTwBelt()

  return {
    wrapper: cn('column w-10/12 pl-7'),
    typeSelect: 'row-center-between mb-5',
    tabs: cn('border-b', br('divider')),

    viewIcon: cn('size-3 mr-2', primary('fill')),
    hint: cn('text-xs mt-4 ml-1 opacity-80', fg('text.digest')),
    inputWrapper: 'row-center mt-2.5 mb-3 ml-1',
    inputLabel: cn('w-32 min-w-32 text-sm', fg('text.digest')),
    input: 'w-40 h-7',
  }
}
