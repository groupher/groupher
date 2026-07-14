import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  active: boolean
  hasActiveColor: boolean
}

export default function useSalon({ active, hasActiveColor }: TProps) {
  const { cn, fg, primary } = useTwBelt()
  const primaryColor = primary('fg')

  return {
    marker: 'align-both size-7 shrink-0 rounded leading-none',
    // Provider sprite icons read color from currentColor.
    icon: active
      ? primaryColor
      : cn(
          fg('digest'),
          hasActiveColor
            ? 'group-hover:text-[var(--marker-active-color)]'
            : `group-hover:${primaryColor}`,
        ),
  }
}
