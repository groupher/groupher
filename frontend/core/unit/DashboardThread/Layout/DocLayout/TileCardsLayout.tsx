import { cnMerge } from '../../salon/layout/doc_layout/cover_thumb_base'
import useSalon from '../../salon/layout/doc_layout/tile_cards_layout'

const TILE_ITEMS = [
  { toneBg: 'redBg' },
  { toneBg: 'blueBg' },
  { toneBg: 'purpleBg' },
  { toneBg: 'greenBg' },
] as const

export default function TileCardsLayout() {
  const s = useSalon()

  return (
    <div className={s.block}>
      <div className={s.grid}>
        {TILE_ITEMS.map((item, index) => (
          <div key={index} className={s.card}>
            <div className={cnMerge(s.toneBox, s[item.toneBg], s.iconBox)} />
            <div className={s.title} />
            <div className={s.desc} />
            <div className={s.footer}>
              <div className={s.circle} />
              <div className={s.meta} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
