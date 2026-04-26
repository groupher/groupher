import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export { cnMerge } from '~/css'

export default function useSalon() {
  const { cnMerge, primary, br } = useTwBelt()
  const base = useBase()

  return {
    block: 'column w-full px-1 py-3 justify-center',
    grid: 'grid w-full grid-cols-3 gap-3',
    card: cnMerge('column rounded-lg border px-3 pt-2.5 pb-1.5', br('divider')),
    icon: cnMerge('size-4 opacity-55', primary('fill')),
    title: cnMerge(base.bar, 'static h-1 w-8 opacity-50 mb-1.5 mt-1.5'),
    desc: cnMerge(base.bar, 'static h-0.5 w-6 opacity-30 mb-1'),
    footer: 'row-center mt-2 gap-x-1',
    circle: cnMerge(base.circle, 'size-2 opacity-20'),
    meta: cnMerge(base.bar, 'h-1 w-4 opacity-25'),
  }
}
