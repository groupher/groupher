import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill } = useTwBelt()

  const common = 'size-3.5 pointer pointer trans-all-100'

  return {
    wrapper: 'row-center h-6 group',
    title: cn('row-center text-base pointer bg-transparent border-0 p-0', fg('title')),
    hintTitle: cn('mt-1 text-xs italic', fg('hint')),
    arrowIcon: cn(common, 'ml-1 -rotate-90', fill('digest')),
    arrowCollapsed: 'rotate-180',
    settingIcon: cn(common, 'mr-1 group-smoky-0', fill('digest')),
    editIcon: cn(common, 'size-3.5 mr-1 opacity-0 group-smoky-0', fill('digest')),
  }
}
