import useTwBelt from '~/hooks/useTwBelt'
import useBase from '..'

export { cnMerge } from '~/css'

export default function useSalon() {
  const { cnMerge, bg } = useTwBelt()
  const base = useBase()

  return {
    block: 'column s-full px-4 py-3 justify-center',
    body: 'column w-full gap-1.5 px-3 py-2.5',
    title: cnMerge(base.bar, 'static h-1.5 w-8 opacity-40'),
    desc: cnMerge(base.bar, 'static h-1 w-28 opacity-22'),
    cards: 'grid grid-cols-3 gap-3 pt-1',
    card: 'column gap-0.5',
    cover: cnMerge('h-8 rounded-md opacity-20', bg('dot')),
    cardTitle: cnMerge(base.bar, 'static ml-0.5 h-1 w-8 mt-0.5 mb-0.5 opacity-50'),
    cardDesc: cnMerge(base.bar, 'static ml-0.5 mt-0.5 h-1 w-12 opacity-20'),
  }
}
