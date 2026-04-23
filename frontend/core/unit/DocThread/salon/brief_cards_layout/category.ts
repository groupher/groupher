import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    title: cn('text-lg', fg('title')),
    items: 'mt-4 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-3 pl-2',
    item: 'row-start w-full text-left',
    icon: cn('size-6 mr-5 mt-2 opacity-50', rainbow('BLACK', 'fill')),
    itemTitle: cn('text-base leading-8', fg('title')),
    itemDesc: cn('text-sm', fg('digest')),
  }
}
