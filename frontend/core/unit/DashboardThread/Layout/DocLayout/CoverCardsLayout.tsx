import useSalon from '../../salon/layout/doc_layout/cover_cards_layout'

export default function CoverCardsLayout() {
  const s = useSalon()

  return (
    <div className={s.block}>
      <div className={s.body}>
        <div className={s.title} />
        <div className={s.desc} />
        <div className={s.cards}>
          <div className={s.card}>
            <div className={s.cover} />
            <div className={s.cardTitle} />
            <div className={s.cardDesc} />
          </div>

          <div className={s.card}>
            <div className={s.cover} />
            <div className={s.cardTitle} />
            <div className={s.cardDesc} />
          </div>

          <div className={s.card}>
            <div className={s.cover} />
            <div className={s.cardTitle} />
            <div className={s.cardDesc} />
          </div>
        </div>
      </div>
    </div>
  )
}
