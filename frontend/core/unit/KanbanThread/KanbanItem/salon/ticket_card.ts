import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, br } = useTwBelt()

  return {
    wrapper: cn('relative w-full mb-2.5 rounded-md border p-3', br('divider'), bg('card')),
    meta: 'row-between mb-2 text-xs',
    number: fg('digest'),
    status: cn('rounded px-1.5 py-0.5', fg('title'), bg('hoverBg')),
    title: cn('block line-clamp-2 text-left text-base font-medium', fg('title')),
    digest: cn('mt-2 line-clamp-3 text-sm', fg('digest')),
    footer: cn('row-between mt-3 gap-2 text-xs', fg('digest')),
    posts: cn('mt-2 space-y-1 border-t pt-2 text-xs', br('divider')),
    postLink: cn('line-clamp-1', fg('digest')),
  }
}
