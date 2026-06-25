import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../salon'

export default function useSalon() {
  const { cn, bg, br, fg } = useTwBelt()
  const base = useBase()

  return {
    wrapper: 'column relative z-20 w-full max-w-72 group',
    paperMask: cn(
      'absolute top-0 -left-1 h-1/2 w-full z-0 rounded -rotate-2 border',
      'group-hover:-rotate-3 trans-all-200',
      bg('alphaBg'),
      br('divider'),
    ),
    inner: cn('px-5 py-4 border rounded z-10 min-h-52', bg('card'), br('divider')),
    //
    header: 'column mb-4',
    groupHeader: cn(base.groupHeader, 'mt-1.5'),
    groupSettingButton: base.groupSettingButton,
    groupSettingIcon: base.groupSettingIcon,
    topping: 'row-between',
    updateDate: cn('text-xs', fg('hint')),
    //
    title: cn('text-lg bold-sm', fg('title')),
    desc: cn('line-clamp-2 text-sm mt-1.5', fg('digest')),
    //
    items: 'column gap-1.5 mt-1.5 trans-all-200',
    item: cn('w-full text-left text-sm', fg('digest')),
    itemTitle: base.pageTextLink,
    footer: cn(
      'align-both h-8 w-full rounded mt-4 group arrow-button-scope pointer',
      bg('hoverBg'),
    ),
  }
}
