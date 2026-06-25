import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../salon'

export default function useSalon() {
  const { cn, fg } = useTwBelt()
  const base = useBase()

  return {
    wrapper: 'mb-4 break-inside-avoid px-5 py-5',
    groupHeader: base.groupHeader,
    groupSettingButton: base.groupSettingButton,
    groupSettingIcon: base.groupSettingIcon,
    title: cn('row-center gap-1 text-lg leading-7', fg('title')),
    titleIndex: 'text-base opacity-50',
    items: 'gap-3 mt-5 column',
    item: base.tocItem,
    articleTitle: base.tocText,
    line: base.tocLine,
    itemIndex: cn('text-xs', base.tocIndex),
  }
}
