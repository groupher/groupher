import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../salon'

export default function useSalon() {
  const { cn, cnMerge, fg } = useTwBelt()
  const base = useBase()

  return {
    wrapper: 'mb-4',
    groupHeader: base.groupHeader,
    groupSettingButton: base.groupSettingButton,
    groupSettingIcon: base.groupSettingIcon,
    title: cn('text-lg leading-none', fg('title')),
    items: 'mt-5 column gap-3',
    articleTitle: cnMerge(base.tocText, 'text-base ml-3'),
    item: base.tocItem,
    line: base.tocLine,
    itemIndex: cn('text-sm tabular-nums', base.tocIndex),
  }
}
