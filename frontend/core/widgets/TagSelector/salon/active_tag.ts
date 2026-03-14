import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, menu } = useTwBelt()

  return {
    wrapper: cn('mr-0.5 scale-90', fg('title')),
    tagItem: cn('row-cwnter h-6 px-1.5 py-1 rounded-md', bg('hoverBg')),
    tagTitle: cn(menu('title'), 'text-sm'),
  }
}
