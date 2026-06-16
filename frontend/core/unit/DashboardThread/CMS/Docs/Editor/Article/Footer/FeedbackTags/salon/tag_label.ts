import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  active: boolean
}

export default function useSalon({ active }: TProps) {
  const { cnMerge, bg, br, fg, selectable } = useTwBelt()

  return {
    wrapper: cnMerge(
      'relative px-2.5 py-1 rounded-md text-xs border trans-all-100',
      bg('cardAlpha'),
      fg('digest'),
      br('divider'),
      selectable('box', { active, border: false }),
    ),
    activeSign: selectable('badge', { size: 'xs' }),
    checkIcon: selectable('check', { size: 'xs' }),
  }
}
