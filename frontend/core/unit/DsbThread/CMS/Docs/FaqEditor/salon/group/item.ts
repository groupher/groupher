import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, fill, hover } = useTwBelt()

  return {
    wrapper: 'group/doc-faq-item py-0.5',
    header: 'row-center min-h-7',
    titleButton: cn(
      'min-w-flex plain-button text-left outline-none',
      fg('digest'),
      `hover:${fg('title')}`,
    ),
    title: cn('text-sm truncate pointer', fg('digest'), `hover:${fg('title')}`),
    actions: 'row-center gap-x-1 opacity-0 group-hover/doc-faq-item:opacity-100 trans-all-100',
    chevronButton: cn('row-center ml-1 size-6 rounded plain-button', hover('bg')),
    chevron: cn('size-3.5 -rotate-90 trans-all-100', fill('digest')),
    chevronOpen: 'rotate-90',
    detail: cn('mt-3 pb-3 text-base leading-7', fg('digest')),
    detailMotion:
      'grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out',
    detailMotionOpen: 'grid-rows-[1fr] opacity-100',
    detailMotionClosed: 'grid-rows-[0fr] opacity-0 pointer-events-none',
    detailClip: 'min-h-0 overflow-hidden',
    detailEditor: 'mt-2',
    detailTextarea: 'text-sm',
    detailSavingBar: 'mt-2',
  }
}
