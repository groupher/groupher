import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cnMerge } from '~/css'

type TProps = TSpace

export default function useSalon({ ...spacing }: TProps) {
  const { cn, bg, fg, br, margin, shadow } = useTwBelt()

  return {
    wrapper: cn('border rounded-md', br('divider'), `hover:${br('digest')}`, margin(spacing)),
    optionRow: 'row items-center gap-2',
    optionTitle: cn('text-sm px-1.5 rounded', fg('digest')),
    optionTitleActive: fg('title'),
    optionDesc: cn('text-xs ml-4', fg('hint')),
    // custom components
    icon: 'size-4.5',
    valueIcon: 'size-4',
    menu: cn('mt-1 rounded-md border p-1', bg('popover.bg'), br('divider'), shadow('md')),
    menuList: 'p-0',
    control: cn('min-h-8 rounded-md !border-0 text-sm', fg('title')),
    valueContainer: 'gap-1 px-1',
    placeholder: cn('text-sm', fg('digest')),
    input: cn('text-sm', fg('title')),
    singleValue: cn('text-sm', fg('title')),
    multiValue: cn('rounded px-1.5 py-0.5', bg('hoverBg')),
    multiValueLabel: cn('text-xs', fg('title')),
    multiValueRemove: cn(
      'rounded-sm px-0.5',
      fg('digest'),
      `hover:${fg('title')}`,
      `hover:${bg('hoverBg')}`,
    ),
    indicatorSeparator: cn('mx-1 w-px', bg('divider')),
    dropdownIndicator: cn('px-1', fg('digest'), `hover:${fg('title')}`),
    clearIndicator: cn('px-1', fg('digest'), `hover:${fg('title')}`),
    noOptionsMessage: cn('px-2 py-1 text-xs', fg('hint')),
    loadingMessage: cn('px-2 py-1 text-xs', fg('hint')),
    option: cn(
      'rounded border border-transparent px-2.5 py-1.5 text-sm',
      fg('digest'),
      `hover:${bg('hoverBg')}`,
      `hover:${fg('title')}`,
    ),
    optionActive: cn(bg('sandBox'), br('digest'), fg('title'), 'pointer'),
  }
}
