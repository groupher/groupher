import { cnMerge } from './cover_thumb_base'
import useBaseSalon from './cover_thumb_base'

export default function useSalon() {
  const base = useBaseSalon()

  return {
    block: cnMerge(base.block, 'justify-center'),
    grid: 'grid w-full grid-cols-2 gap-4 px-5 py-4',
    card: 'column gap-3 rounded-xl border border-black/6 bg-white/80 px-4 py-3.5',
    iconBox: 'size-5',
    title: cnMerge(base.bar, 'h-2 w-12 opacity-40'),
    desc: cnMerge(base.bar, 'h-1 w-16 opacity-22'),
    footer: 'row-center gap-2 pt-1.5',
    circle: cnMerge(base.circle, 'size-3 opacity-25'),
    meta: cnMerge(base.bar, 'h-1 w-12 opacity-25'),
    toneBox: base.iconBox,
    redBg: base.redBg,
    blueBg: base.blueBg,
    purpleBg: base.purpleBg,
    greenBg: base.greenBg,
  }
}
