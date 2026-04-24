import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  active?: boolean
}

export default function useSalon({ active = false }: TProps = {}) {
  const { cn, br, fg, bg } = useTwBelt()

  return {
    wrapper: cn(
      'row-center w-full relative mb-2 p-2 pb-2.5 ml-0.5 pointer border-b border-dashed',
      br('divider'),
      active && bg('hoverBg'),
    ),
    header: '',
    title: cn('text-base line-clamp-1', fg('title')),
    upvotes: cn('rounded-md px-2 py-0.5 border', br('divider')),
  }
}
