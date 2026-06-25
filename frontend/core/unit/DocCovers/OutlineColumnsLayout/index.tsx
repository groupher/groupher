import { COLOR } from '~/const/colors'

import type { TDocCoverLayoutProps } from '../spec'
import Category from './Category'
import useSalon from './salon'

export default function OutlineColumnsLayout({
  groups,
  editable,
  onEditGroup,
}: TDocCoverLayoutProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.cols}>
        {groups.map((group, categoryIndex) => (
          <Category
            key={group.id}
            categoryIndex={categoryIndex + 1}
            color={COLOR.BLUE}
            group={group}
            editable={editable}
            onEditGroup={onEditGroup}
          />
        ))}
      </div>
    </div>
  )
}
