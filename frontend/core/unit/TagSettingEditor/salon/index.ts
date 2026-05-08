import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, fg, bg, rainbow } = useTwBelt()

  return {
    wrapper: 'flex min-h-screen flex-col',
    basicInfo: 'row-center mb-6 px-6',
    dotSelector: cn('align-both size-8 circle border pointer', br('divider'), bg('hoverBg')),
    titleDot: 'size-7 circle',
    title: cn('text-sm bold-sm px-6 mb-2', fg('title')),
    titleInput: 'ml-2.5 h-9',
    //
    selectorWrapper: 'px-6 mt-2.5',
    desc: cn('text-xs px-6 mb-2.5 leading-5', fg('digest')),
    navi: cn('text-xs no-underline hover:underline ml-px mr-0.5', fg('link')),
    inputWrapper: 'px-6',
    slugInput: 'h-9',
    error: cn('mt-1.5 text-xs', fg('rainbow.red')),
    inputer: 'min-h-24',
    rainbow,
  }
}
