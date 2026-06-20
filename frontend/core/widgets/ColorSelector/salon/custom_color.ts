import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon({ stacked = false } = {}) {
  const { cn, bg, fg, fill } = useTwBelt()

  return {
    wrapper: cn('w-fit ', stacked && 'whitespace-nowrap row-center mr-1.5'),
    divider: cn('h-5 w-px mr-2', bg('divider')),
    title: cn('text-xs ml-0.5', fg('title')),
    inner: 'align-both size-7',
    dot: cn(
      'align-both relative size-6 rounded-full pointer trans-all-100 hover:-mt-0.5',
      stacked && 'scale-80',
    ),
    dotRing: cn(
      'abs-full rounded-full',
      'bg-[conic-gradient(from_180deg,_#ff6b6b,_#f59e0b,_#facc15,_#22c55e,_#06b6d4,_#3b82f6,_#8b5cf6,_#ec4899,_#ff6b6b)]',
      '[mask-image:radial-gradient(circle,transparent_50%,black_55%)]',
      '[mask-repeat:no-repeat]',
    ),
    dotInner:
      'absolute left-1/2 top-1/2 z-10 align-both size-3 -translate-x-1/2 -translate-y-1/2 rounded-full',
    checkIcon: cn('size-2', fill('button.fg')),
    customBlock: 'mt-1.5 px-1.5 pb-1.5',
    customTitle: cn('mb-2 text-base opacity-65', fg('digest')),
  }
}
