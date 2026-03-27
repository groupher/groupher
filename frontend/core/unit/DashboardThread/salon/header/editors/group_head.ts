import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill } = useTwBelt()

  const common = 'size-3.5 pointer pointer trans-all-100'

  return {
    wrapper: 'row-center w-11/12 h-6 group',
    title: cn('row-center text-sm', fg('title')),
    hintTitle: cn('mt-1 text-xs italic', fg('hint')),
    arrowIcon: cn(common, 'ml-1 -rotate-90', fill('digest')),
    settingIcon: cn(common, 'mr-1 group-smoky-0', fill('digest')),
    editIcon: cn(common, 'size-3.5 mr-1 opacity-0 group-smoky-0', fill('digest')),
  }
}
