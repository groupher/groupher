import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, bg, fg, fill } = useTwBelt()

  return {
    wrapper: cn('w-fit row-center whitespace-nowrap'),
    divider: cn('h-5 w-px mr-2', bg('divider')),
    title: cn('text-xs ml-2', fg('title')),
    inner: 'align-both size-7',
    dot: cn(
      'relative size-6 rounded-full pointer trans-all-100 hover:-mt-0.5',
      'bg-[conic-gradient(from_180deg,_#ff6b6b,_#f59e0b,_#facc15,_#22c55e,_#06b6d4,_#3b82f6,_#8b5cf6,_#ec4899,_#ff6b6b)]',
    ),
    dotInner:
      'absolute left-1/2 top-1/2 align-both size-4 -translate-x-1/2 -translate-y-1/2 rounded-full',
    checkIcon: cn('size-2', fill('button.fg')),
    customBlock: 'mt-1.5 px-1.5 pb-1.5',
    customTitle: cn('mb-2 text-base opacity-65', fg('digest')),
  }
}
