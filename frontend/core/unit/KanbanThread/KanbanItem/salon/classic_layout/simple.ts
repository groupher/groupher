import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  active?: boolean
}

export default function useSalon({ active = false }: TProps = {}) {
  const { cn, fg, bg, br } = useTwBelt()

  return {
    wrapper: cn(
      'relative w-full pt-2.5 pb-3 px-2.5 mb-2.5 rounded-md border border-transparent',
      `hover:${br('divider')}`,
      bg('card'),
      active && br('divider'),
    ),
    header: 'row-between mb-2.5',
    title: cn('text-base w-full line-clamp-2 text-left block', fg('title')),
    footer: 'row-between text-xs mt-2',
  }
}
