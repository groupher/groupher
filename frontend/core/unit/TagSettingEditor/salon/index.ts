import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, fg, bg, rainbow } = useTwBelt()

  return {
    wrapper: 'flex min-h-screen flex-col',
    basicInfo: 'row-center mb-6 px-6',
    iconPicker: cn('align-both size-8 rounded-md border', br('divider'), bg('card')),
    dotSelector: cn('align-both size-8 rounded-md border p-1 pointer', br('divider'), bg('card')),
    titleDot: 'h-full w-full rounded',
    title: cn('text-sm bold-sm px-6 mb-2', fg('title')),
    titleInput: 'h-9',
    iconSetting: 'row-center gap-2 px-6',
    //
    selectorWrapper: 'px-6 mt-2.5',
    desc: cn('text-xs px-6 mb-2.5 leading-5', fg('digest')),
    navi: cn('text-xs no-underline hover:underline ml-px mr-0.5', fg('link')),
    inputWrapper: 'px-6',
    slugInput: 'h-9',
    error: cn('mt-1.5 text-xs', fg('rainbow.red')),
    inputer: 'min-h-24',
    markdownEditor: 'w-full',
    rainbow,
  }
}
