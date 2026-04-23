import AdminSVG from '~/icons/AdminStar'
import AirBallonSVG from '~/icons/AirBalloon'
import BillingSVG from '~/icons/Billing'
import BookSVG from '~/icons/Book'
import CmsSVG from '~/icons/CMS'

import useSalon, { cnMerge } from '../../salon/layout/doc_layout/tile_cards_layout'

export default function TileCardsLayout() {
  const s = useSalon()

  return (
    <div className={s.block}>
      <div className={s.grid}>
        <div className={s.card}>
          <BookSVG className={s.icon} />
          <div className={s.title} />
          <div className={cnMerge(s.desc, 'w-10')} />
          <div className={s.desc} />
          <div className={s.footer}>
            <div className={s.circle} />
            <div className={s.meta} />
          </div>
        </div>

        <div className={s.card}>
          <AdminSVG className={s.icon} />
          <div className={s.title} />
          <div className={cnMerge(s.desc, 'w-10')} />
          <div className={s.desc} />
          <div className={s.footer}>
            <div className={s.circle} />
            <div className={s.meta} />
          </div>
        </div>

        <div className={s.card}>
          <BillingSVG className={s.icon} />
          <div className={s.title} />
          <div className={cnMerge(s.desc, 'w-9')} />
          <div className={s.desc} />
          <div className={s.footer}>
            <div className={s.circle} />
            <div className={s.meta} />
          </div>
        </div>

        <div className={s.card}>
          <AirBallonSVG className={s.icon} />
          <div className={s.title} />
          <div className={cnMerge(s.desc, 'w-10')} />
          <div className={s.desc} />
          <div className={s.footer}>
            <div className={s.circle} />
            <div className={s.meta} />
          </div>
        </div>

        <div className={s.card}>
          <CmsSVG className={s.icon} />
          <div className={s.title} />
          <div className={cnMerge(s.desc, 'w-10')} />
          <div className={s.desc} />
          <div className={s.footer}>
            <div className={s.circle} />
            <div className={s.meta} />
          </div>
        </div>
      </div>
    </div>
  )
}
