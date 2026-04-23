import useTwBelt from '~/hooks/useTwBelt'

import useBaseSalon from './cover_thumb_base'

export { cnMerge } from '~/css'

export default function useSalon() {
  const { cnMerge } = useTwBelt()
  const base = useBaseSalon()

  return {
    block: cnMerge(base.block, 'justify-center'),
    list: 'column w-full gap-4 px-7 py-5',
    group: 'column gap-2',
    row: 'row-center gap-3',
    title: cnMerge(base.bar, 'h-1 mb-0.5 opacity-50'),
    articleTitle: cnMerge(base.bar, 'h-1 opacity-30'),
    line: cnMerge(base.bar, 'h-px opacity-20 grow'),
    meta: cnMerge(base.bar, 'h-1 opacity-20'),
  }
}
