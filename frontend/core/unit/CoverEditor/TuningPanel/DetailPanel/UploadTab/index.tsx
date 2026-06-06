import DeleteSVG from '~/icons/Delete'

import GroupItem from '../GroupItem'
import GroupTitle from '../GroupTitle'
import useSalon from './salon'

type TProps = {
  onDelete: () => void
  onReplace: () => void
}

export default function UploadTab({ onDelete, onReplace }: TProps) {
  const s = useSalon()

  return (
    <section className={s.wrapper}>
      <GroupTitle>Upload</GroupTitle>
      <div className={s.items}>
        <GroupItem label='Actions'>
          <div className={s.actionRow}>
            <button type='button' className={s.item} onClick={onReplace}>
              Replace image
            </button>
            <button type='button' className={s.deleteItem} onClick={onDelete}>
              <DeleteSVG className={s.deleteIcon} />
              Delete
            </button>
          </div>
        </GroupItem>
      </div>
    </section>
  )
}
