import useTwBelt from '~/hooks/useTwBelt'

import useBase from '.'

export default () => {
  const { cn, fg, menu } = useTwBelt()
  const base = useBase()

  return {
    wrapper: 'column w-52',
    group: 'row-center wrap w-full mb-2.5',
    selectItem: cn(base.selectItem, 'mb-1 mr-1'),
    groupTitle: cn('text-xs ml-1.5 mb-1 mt-0.5', fg('digest')),
    title: cn(menu('title'), 'text-sm'),
  }
}
