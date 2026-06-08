import PlusSVG from '~/icons/Plus'
import TrashSVG from '~/icons/Trash'
import UploadSVG from '~/icons/Upload'

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
        <div className={s.primaryImageArea}>
          <ImageTitle
            type='primary'
            action={
              <div className={s.uploadActions}>
                <button type='button' className={s.actionButton} onClick={onReplace}>
                  <UploadSVG className={s.actionIcon} />
                  replace
                </button>
                <button type='button' className={s.deleteButton} onClick={onDelete}>
                  <TrashSVG className={s.deleteIcon} />
                  delete
                </button>
              </div>
            }
          />
          <ImageFields setting={setting} />
        </div>

        <div className={s.sectionDivider} />

        <div className={s.actionArea}>
          <button type='button' className={s.addImageButton} disabled aria-label='Add second image'>
            <PlusSVG className={s.addImageIcon} />
            Add secondary image
          </button>
        </div>
      </section>
    </div>
  )
}
