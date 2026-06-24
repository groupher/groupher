import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../salon'

export default function useSalon() {
  const { cn, cnMerge, fg, br, bg } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn(
      'column h-full rounded-lg border px-6 py-6 text-left outline-none',
      bg('card'),
      br('divider'),
    ),
    iconBox: 'mb-2',
    groupHeader: base.groupHeader,
    groupSettingButton: base.groupSettingButton,
    groupSettingIcon: base.groupSettingIcon,
    title: cn('text-lg bold-sm leading-9', fg('title')),
    items: 'column grow gap-2 mt-2 min-w-0',
    item: cnMerge(base.pageTextLink, 'text-sm leading-6', fg('digest')),
  }
}
