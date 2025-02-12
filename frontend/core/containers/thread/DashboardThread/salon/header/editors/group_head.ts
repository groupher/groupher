import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill } = useTwBelt()

  const common = 'size-3.5 pointer pointer trans-all-100'

  return {
    wrapper: cn('row-center w-11/12 h-6 group'),
    title: cn('row-center text-sm', fg('text.title')),
    hintTitle: cn('mt-1 text-xs italic', fg('text.hint')),
    arrowIcon: cn(common, 'ml-1 -rotate-90', fill('text.digest')),
    settingIcon: cn(common, 'mr-1 group-smoky-0', fill('text.digest')),
    editIcon: cn(common, 'size-3.5 mr-1 opacity-0 group-smoky-0', fill('text.digest')),
  }
}
