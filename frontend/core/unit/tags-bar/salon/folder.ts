import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  isFolderOpen: boolean
}

export default function useSalon({ isFolderOpen }: TProps) {
  const { cn, fg, zise, fill } = useTwBelt()

  return {
    header: 'row-center mb-2 ml-0.5 pointer hover:opacity-80 transition-opacity',
    arrowBox: 'row-center size-4',
    title: 'row-center ml-1.5',
    folderTitle: cn('text-sm mr-2', fg('digest')),
    arrow: cn(
      'transition-transform',
      isFolderOpen ? 'rotate-[270deg]' : 'rotate-[180deg]',
      zise(3.5),
      fill('digest'),
    ),
    count: cn(
      'text-sm mt-px',
      'before:content-["("] after:content-[")"] before:text-xs after:text-xs before:mr-px after:ml-0.5 before:opacity-80 after:opacity-80',
      fg('title'),
    ),
    content: cn('w-full mb-4', isFolderOpen ? 'block' : 'hidden'),
    subToggle: 'row-center mt-1 ml-0.5 pointer',
    subToggleTitle: cn('text-xs ml-2 p-0.5 rounded', fg('digest')),
    toggleIcon: cn('ml-0.5', zise(3), fill('digest')),
  }
}
