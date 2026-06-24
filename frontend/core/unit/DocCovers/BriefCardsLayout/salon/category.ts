import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../salon'

export default function useSalon() {
  const { cn, cnMerge, fg } = useTwBelt()
  const base = useBase()

  return {
    groupHeader: base.groupHeader,
    groupSettingButton: base.groupSettingButton,
    groupSettingIcon: base.groupSettingIcon,
    title: cn('text-lg', fg('title')),
    items: 'mt-4 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-3 pl-2',
    item: 'row-start w-full text-left',
    iconSlot: 'mr-5 mt-2 align-both shrink-0',
    itemTitle: cnMerge(base.pageTextLink, 'text-base leading-8', fg('title')),
    itemDesc: cn('text-sm', fg('digest')),
  }
}
