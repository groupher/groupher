import { COLOR } from '~/const/colors'

import type { TDocCoverLayoutProps } from '../spec'
import Category from './Category'
import useSalon from './salon'

export default function OutlineColumnsLayout({
  cards,
  editable,
  onEditCard,
}: TDocCoverLayoutProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.cols}>
        {cards.map((section, categoryIndex) => (
          <Category
            key={section.id}
            categoryIndex={categoryIndex + 1}
            color={COLOR.BLUE}
            section={section}
            editable={editable}
            onEditCard={onEditCard}
          />
        ))}
      </div>
    </div>
  )
}
