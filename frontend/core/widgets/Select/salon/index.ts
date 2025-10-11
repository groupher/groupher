import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, bg, fg, br, margin } = useTwBelt()

  return {
    wrapper: cn(margin(spacing)),
    optionRow: 'row items-end',
    optionTitle: cn('text-sm px-1.5 rounded', fg('transparent')),
    optionTitleActive: fg('text.title'),
    optionDesc: cn('text-xs ml-4', fg('text.hint')),
    // custom components
    menu: cn('mt-0', bg('container')),
    menuList: 'my-0 pb-px',
    control: cn('border', bg('alphaBg'), br('divider'), `hover:${br('text.digest')}`),
    option: cn('bg-transparent', `hover:${bg('hoverBg')}`),
    optionActive: cn(bg('hoverBg'), fg('text.title'), 'pointer'),
  }
}
