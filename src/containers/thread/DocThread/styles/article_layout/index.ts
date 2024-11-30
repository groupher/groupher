import useBase from '..'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  filterOpen: boolean
}

export default ({ filterOpen }: TProps) => {
  const { cn, fg, br } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn('row justify-center w-full relative'),
    header: 'mb-4',
    //
    content: cn(
      base.main,
      'grow text-base pl-12 pr-0 max-w-full',
      filterOpen ? 'w-[680px]' : 'px-20',
    ),
    //
    title: cn('text-2xl bold-sm', fg('text.title')),
    faq: 'ml-8 -mt-2.5',

    sidebar: cn(
      'column w-52 min-w-52 pt-8 border-r',
      br('divider'),
      filterOpen ? 'max-w-auto visiable' : 'min-w-0 max-w-0 w-0 hidden overflow-hidden border-none',
    ),
  }
}
