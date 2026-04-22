import { mockHelpCats } from '~/mock'
import useSalon from '../salon/cover_cards_layout'
import Category from './Category'

export default function CoverCardsLayout() {
  const cats = mockHelpCats()
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.cats}>
        {cats.map((cat) => (
          <Category key={cat.id} title={cat.title} desc={cat.desc} articles={cat.articles} />
        ))}
      </div>
    </div>
  )
}
