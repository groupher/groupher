import useTwBelt from '~/hooks/useTwBelt'
import useBase from '..'

export { cnMerge } from '~/css'

export default function useSalon() {
  const { cnMerge } = useTwBelt()
  const base = useBase()

  return {
    block: 'column s-full px-4 py-3 justify-center',
    body: 'column w-full gap-4 px-5 py-5',
    title: cnMerge(base.bar, 'static h-2 w-16 opacity-40'),
    desc: cnMerge(base.bar, 'static h-1 w-28 opacity-22'),
    cards: 'grid grid-cols-3 gap-3 pt-1',
    card: 'column gap-2.5',
    cover: 'h-12 rounded-xl bg-black/10',
    cardTitle: cnMerge(base.bar, 'static h-2 w-12 opacity-40'),
    cardDesc: cnMerge(base.bar, 'static h-1 w-16 opacity-22'),
  }
}
