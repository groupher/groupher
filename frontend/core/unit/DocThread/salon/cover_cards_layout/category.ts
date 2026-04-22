import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, br } = useTwBelt()

  return {
    wrapper: cn(
      'column overflow-hidden rounded-[2rem] border text-left trans-all-200 hover:-translate-y-1',
      bg('card'),
      br('divider'),
    ),
    cover: 'relative h-56 w-full bg-cover bg-center',
    coverInner: 'absolute inset-x-0 bottom-0 p-6',
    coverMeta: 'text-xs uppercase tracking-[0.24em] text-white/70',
    coverTitle: 'mt-2 text-[2rem] leading-none text-white',
    content: 'column gap-4 px-6 py-5',
    desc: cn('text-sm leading-6', fg('digest')),
    footer: 'row-between',
    count: cn('text-sm', fg('hint')),
  }
}
