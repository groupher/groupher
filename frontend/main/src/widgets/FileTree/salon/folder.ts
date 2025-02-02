import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  show: boolean
  isFolderOpen: boolean
}

export default ({ show, isFolderOpen }: TProps) => {
  const { cn, fg, bg, fill, cut } = useTwBelt()

  return {
    wrapper: cn(''),
    header: cn('group row-center pointer relative mb-2', !show && 'hidden'),
    title: cn('row-center bold-sm mb-1.5'),
    folderTitle: cn('text-sm mr-2 grow', 'group-hover:opacity-80', fg('text.title'), cut('w-28')),
    //
    arrowIcon: cn(
      'size-4 group-smoky-0 trans-all-200',
      isFolderOpen ? '-rotate-90' : 'rotate-0',
      fill('text.digest'),
    ),
    //
    content: cn('w-full mb-8 -ml-1', isFolderOpen ? 'block' : 'hidden'),
    subToggle: cn(
      'align-both text-xs w-fit pointer px-2 py-0.5 rounded-md mt-1.5 ml-0.5',
      `hover:${fg('text.title')}`,
      bg('hoverBg'),
      fg('text.digest'),
    ),
  }
}
