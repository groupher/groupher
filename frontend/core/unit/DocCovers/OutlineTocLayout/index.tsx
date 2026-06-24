import type { TDocCoverLayoutProps } from '../spec'
import Category from './Category'
import useSalon from './salon'

export default function OutlineTocLayout({ groups, editable, onEditGroup }: TDocCoverLayoutProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.cats}>
        {groups.map((group) => (
          <Category key={group.id} group={group} editable={editable} onEditGroup={onEditGroup} />
        ))}
      </div>
    </div>
  )
}
