import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, avatar } = useTwBelt()

  return {
    author: 'row-center gap-2',
    authorAvatar: cn('size-4 shrink-0', avatar('sm')),
  }
}
