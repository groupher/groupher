import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, primary, sexyBorder, vividDark } = useTwBelt()

  return {
    wrapper: 'px-8 py-6',
    desc: cn('text-xs mt-1', fg('hint')),
    footer: 'align-both w-full pr-12 gap-x-3.5',
    rootSign: cn(
      'inline-flex text-xs bold-sm px-1.5 rounded-md mb-1 border',
      fg('button.fg'),
      primary('bg'),
      vividDark(),
    ),
    divider: cn(sexyBorder(), 'mb-8'),
  }
}
