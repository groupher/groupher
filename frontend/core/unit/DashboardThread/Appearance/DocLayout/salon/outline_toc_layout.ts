import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../useAppearanceBaseSalon'

export { cnMerge } from '~/css'

export default function useSalon() {
  const { cnMerge } = useTwBelt()
  const base = useBase()

  return {
    block: 'column s-full px-4 py-3 justify-center',
    list: 'column w-full gap-4 px-7 py-5',
    group: 'column gap-2',
    row: 'row-center gap-3',
    title: cnMerge(base.bar, 'static h-1 mb-0.5 opacity-50'),
    articleTitle: cnMerge(base.bar, 'static h-1 opacity-30'),
    line: cnMerge(base.bar, 'static h-px opacity-20 grow'),
    meta: cnMerge(base.bar, 'static h-1 opacity-20'),
  }
}
