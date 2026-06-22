import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { bg, br, cn, fg, fill, hover, shadow } = useTwBelt()

  return {
    wrapper: 'row-center mb-12 w-full',
    searchBox: 'relative grow',
    searchFrame: cn(
      'row-center w-full h-10 rounded-md border',
      'trans-all-200',
      `hover:${br('digest')}`,
      br('divider'),
      bg('card'),
    ),
    searchField: 'min-w-0 grow',
    input: cn(
      'outline-none tabular-nums box-border m-0 list-none relative inline-block w-full bg-transparent border-0 appearance-none',
      'px-4 py-1 h-9 rounded-md text-sm text-left leading-normal caret-inherit',
      'placeholder:italic placeholder:opacity-65 placeholder:text-sm',
      fg('digest'),
    ),
    listBox: cn(
      'absolute z-30 top-11 left-0 w-full max-h-72 overflow-y-auto rounded-md border p-1 outline-none',
      bg('popover.bg'),
      br('divider'),
      shadow('md'),
    ),
    item: cn(
      'block w-full min-w-0 rounded px-2.5 py-2 outline-none pointer text-left',
      hover('bg'),
      'data-[focused]:bg-menuHoverBg data-[selected]:bg-menuHoverBg',
    ),
    itemInner: 'flex w-full min-w-0 items-start text-left',
    avatarBox: 'flex h-9 w-9 shrink-0 items-start justify-start',
    avatar: 'block size-9 rounded-md',
    itemIntro: 'column min-w-flex ml-3 pt-0.5 text-left',
    itemHeader: 'flex min-w-0 items-baseline text-left',
    itemName: cn('text-sm bold-sm truncate', fg('title')),
    itemLogin: cn('text-xs ml-2 shrink-0', fg('hint')),
    itemBio: cn('text-xs mt-0.5 truncate', fg('digest')),
    empty: cn('px-2.5 py-2 text-xs', fg('hint')),
    selectedList: 'row-center shrink-0 gap-x-1.5 pr-1.5',
    selectedUser: cn(
      'row-center h-8 max-w-40 rounded-md border bg-transparent px-1.5 py-0',
      br('divider'),
      hover('bg'),
    ),
    selectedAvatar: 'size-6 shrink-0 rounded',
    selectedName: cn('ml-1.5 max-w-20 truncate text-xs', fg('title')),
    removeButton: cn('align-both ml-1 size-4 shrink-0 rounded plain-button', hover('bg')),
    removeIcon: cn('size-2.5 opacity-50', fill('digest')),
    plusIcon: cn('size-3 -ml-0.5 mr-1.5', fill('button.fg')),
    addBtn: 'ml-4 -mt-1.5',
  }
}
