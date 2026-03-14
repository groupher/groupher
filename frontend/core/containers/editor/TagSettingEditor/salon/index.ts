import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, fg, bg, rainbow } = useTwBelt()

  return {
    wrapper: 'mt-10 pb-24',
    basicInfo: 'row-center ml-7 mb-6',
    dotSelector: cn('align-both size-8 circle border pointer', br('divider'), bg('hoverBg')),
    titleDot: 'size-7 circle',
    title: cn('text-sm bold-sm pl-7 mb-2', fg('title')),
    titleInput: 'w-80 ml-2.5',
    //
    selectorWrapper: 'px-7 mt-2.5',
    desc: cn('text-xs px-7 mb-2.5', fg('digest')),
    navi: cn('text-xs no-underline hover:underline ml-px mr-0.5', fg('link')),
    inputer: 'w-80 ml-7',
    rainbow,
  }
}
