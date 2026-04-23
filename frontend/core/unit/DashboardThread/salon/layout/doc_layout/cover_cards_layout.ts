import { cnMerge } from './cover_thumb_base'
import useBaseSalon from './cover_thumb_base'

export default function useSalon() {
  const base = useBaseSalon()

  return {
    block: cnMerge(base.block, 'justify-center'),
    body: 'column w-full gap-4 px-5 py-5',
    title: cnMerge(base.bar, 'h-2 w-16 opacity-40'),
    desc: cnMerge(base.bar, 'h-1 w-28 opacity-22'),
    cards: 'grid grid-cols-2 gap-4 pt-1',
    card: 'column gap-2.5',
    cover: 'h-12 rounded-xl bg-black/10',
    cardTitle: cnMerge(base.bar, 'h-2 w-12 opacity-40'),
    cardDesc: cnMerge(base.bar, 'h-1 w-16 opacity-22'),
  }
}
