import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, bg, fg, br, margin } = useTwBelt()

  return {
    wrapper: cn(margin(spacing)),
    optionRow: 'row items-end',
    optionTitle: cn('text-sm px-1.5 rounded', fg('digest')),
    optionTitleActive: fg('title'),
    optionDesc: cn('text-xs ml-4', fg('hint')),
    // custom components
    icon: 'size-6 mr-2',
    menu: cn('mt-0', bg('card')),
    menuList: 'my-0 pb-px',
    control: cn('border', bg('alphaBg'), br('divider'), `hover:${br('digest')}`),
    option: cn('bg-transparent', `hover:${bg('hoverBg')}`),
    optionActive: cn(bg('hoverBg'), fg('title'), 'pointer'),
  }
}
