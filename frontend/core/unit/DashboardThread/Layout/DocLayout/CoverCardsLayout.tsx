import useSalon, { cnMerge } from './salon/cover_cards_layout'

export default function CoverCardsLayout() {
  const s = useSalon()

  return (
    <div className={s.block}>
      <div className={s.body}>
        <div className={cnMerge(s.title, 'w-1/5')} />
        <div className={cnMerge(s.desc, 'w-1/3')} />
        <div className={s.cards}>
          <div className={s.card}>
            <div className={s.cover} />
            <div className={s.cardTitle} />
            <div className={s.cardDesc} />
            <div className={cnMerge(s.cardDesc, 'w-3/5')} />
          </div>

          <div className={s.card}>
            <div className={s.cover} />
            <div className={cnMerge(s.cardTitle, 'w-1/2')} />
            <div className={s.cardDesc} />
            <div className={cnMerge(s.cardDesc, 'w-1/5')} />
          </div>

          <div className={s.card}>
            <div className={s.cover} />
            <div className={s.cardTitle} />
            <div className={s.cardDesc} />
          </div>
        </div>
      </div>

      <div className={s.body}>
        <div className={s.title} />
        <div className={cnMerge(s.desc, 'w-1/2')} />
        <div className={s.cards}>
          <div className={s.card}>
            <div className={s.cover} />
            <div className={s.cardTitle} />
            <div className={s.cardDesc} />
          </div>

          <div className={s.card}>
            <div className={s.cover} />
            <div className={cnMerge(s.cardTitle, 'w-1/3')} />
            <div className={s.cardDesc} />
          </div>
        </div>
      </div>
    </div>
  )
}
