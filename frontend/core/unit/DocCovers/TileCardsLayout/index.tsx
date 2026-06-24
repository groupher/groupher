import { COLOR } from '~/const/colors'

import type { TDocCoverLayoutProps } from '../spec'
import Category from './Category'
import useSalon from './salon'

export default function TileCardsLayout({ groups, editable, onEditGroup }: TDocCoverLayoutProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.cats}>
        {groups.map((group) => (
          <Category
            key={group.id}
            group={group}
            color={COLOR.BLUE}
            editable={editable}
            onEditGroup={onEditGroup}
          />
        ))}
      </div>
    </div>
  )
}
