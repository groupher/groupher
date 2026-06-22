import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../salon'

export default function useSalon() {
  const { cn, cnMerge, fg } = useTwBelt()
  const base = useBase()

  return {
    section: 'column',
    wrapper: 'column overflow-hidden text-left trans-all-200',
    title: cn('text-lg bold-sm', fg('title')),
    sectionDesc: cn('mb-5 text-sm leading-8', fg('digest')),
    cards: 'grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3',
    cover: 'h-44 w-full bg-cover bg-center rounded-xl',
    //
    content: 'column px-1 mb-2',
    articleTitle: cnMerge(base.articleTitle, fg('title'), 'text-base bold-sm mt-4'),
    desc: cn('text-sm leading-5 mt-1', fg('digest')),
    footer: 'row-between',
    count: cn('text-sm', fg('hint')),
  }
}
