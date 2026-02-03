import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn, cnMerge } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, bg, fg, br, margin, shadow } = useTwBelt()

  return {
    wrapper: margin(spacing),
    optionRow: 'row items-center gap-2 group',
    optionTitle: cn('text-sm px-1.5 rounded', fg('digest'), `group-hover:${fg('title')}`),
    optionTitleActive: cn(fg('title')),
    // custom components
    icon: 'size-4.5',
    valueIcon: 'size-4',
    menu: cn('mt-1 rounded-md border p-1', bg('popover.bg'), br('divider'), shadow('md')),
    menuList: 'p-0',
    control: cn('h-8 rounded-md'),
    valueContainer: cn('gap-1 px-1 pointer', fg('digest')),
    placeholder: cn('text-sm', fg('digest')),
    input: '',
    singleValue: cn('text-sm', fg('digest')),
    multiValue: cn('rounded px-1.5 py-0.5', bg('hoverBg')),
    multiValueLabel: cn('text-xs', fg('title')),
    multiValueRemove: cn(
      'rounded-sm px-0.5',
      fg('digest'),
      `hover:${fg('title')}`,
      `hover:${bg('hoverBg')}`,
    ),
    indicatorSeparator: cn('mx-1 w-px', bg('divider')),
    dropdownIndicator: cn('px-1 pointer', fg('digest'), `hover:${fg('title')}`),
    clearIndicator: cn('px-1', fg('digest'), `hover:${fg('title')}`),
    noOptionsMessage: cn('px-2 py-1 text-xs', fg('hint')),
    loadingMessage: cn('px-2 py-1 text-xs', fg('hint')),
    option: cn(
      'rounded border border-transparent px-2.5 py-1.5 text-sm pointer',
      fg('digest'),
      `hover:${bg('hoverBg')}`,
      `hover:${fg('title')}`,
    ),
    optionActive: cn(bg('sandBox'), br('digest'), 'pointer', fg('title')),
  }
}
