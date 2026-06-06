import DeleteSVG from '~/icons/Delete'
import PlusSVG from '~/icons/Plus'

import type { TTuningSetting } from '../../../spec'
import ImageFields from './ImageFields'
import ImageTitle from './ImageTitle'
import useSalon from './salon'

type TProps = {
  setting: TTuningSetting
  onDelete: () => void
  onReplace: () => void
}

export default function BasicTab({ setting, onDelete, onReplace }: TProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <section className={s.imageSection}>
        <ImageTitle type='primary' />
        <ImageFields setting={setting} />

        <div className={s.sectionDivider} />

        <div className={s.actionArea}>
          <button type='button' className={s.addImageButton} disabled aria-label='Add second image'>
            <PlusSVG className={s.addImageIcon} />
            Add image
          </button>

          <div className={s.uploadActions}>
            <button type='button' className={s.actionButton} onClick={onReplace}>
              Replace image
            </button>
            <button type='button' className={s.deleteButton} onClick={onDelete}>
              <DeleteSVG className={s.deleteIcon} />
              Delete
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
