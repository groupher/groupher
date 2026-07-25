import type { TDocCoverLayoutProps } from '../spec'
import Category from './Category'
import useSalon from './salon'

export default function OutlineTocLayout({ cards, editable, onEditCard }: TDocCoverLayoutProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.cats}>
        {cards.map((section) => (
          <Category
            key={section.id}
            section={section}
            editable={editable}
            onEditCard={onEditCard}
          />
        ))}
      </div>
    </div>
  )
}
