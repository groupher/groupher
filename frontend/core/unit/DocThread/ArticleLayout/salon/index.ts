import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

type TProps = {
  outlineOpen: boolean
}

export default function useSalon({ outlineOpen }: TProps) {
  const { cn, fg, br } = useTwBelt()
  const base = useBase()

  return {
    wrapper: 'row justify-center w-full relative',
    header: 'mb-4',
    content: cn(
      base.main,
      'grow text-base pl-12 pr-0 max-w-full trans-all-200',
      outlineOpen ? 'w-[680px]' : 'px-0 mr-20',
      fg('digest'),
    ),
    title: cn('text-2xl bold-sm mt-4', fg('title')),
    faq: 'ml-8 -mt-2.5',

    sidebar: cn(
      'column w-48 shrink-0 pt-8 border-r',
      'transition-all duration-300 ease-in-out',
      br('divider'),
      outlineOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
    ),
  }
}
