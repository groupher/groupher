import { mockHelpCats } from '~/mock'
import useSalon from '../salon/brief_cards_layout'
import Category from './Category'

export default function BriefCardsLayout() {
  const cats = mockHelpCats()
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.groups}>
        {cats.map((cat) => (
          <Category key={cat.id} title={cat.title} articles={cat.articles} />
        ))}
      </div>
    </div>
  )
}
