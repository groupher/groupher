import PlusSVG from '~/icons/Plus'
import TrashSVG from '~/icons/Trash'
import UploadSVG from '~/icons/Upload'

import { COVER_IMAGE_WHICH } from '../../../constant'
import type { TCoverImageConfig, TCoverImageWhich } from '../../../spec'
import ImageFields from './ImageFields'
import ImageTitle from './ImageTitle'
import useSalon from './salon'

type TProps = {
  image: TCoverImageConfig | null
  which: TCoverImageWhich
  onAddImage: (which: TCoverImageWhich) => void
  onDelete: (which: TCoverImageWhich) => void
  onReplace: (which: TCoverImageWhich) => void
}

export default function ImageSection({ image, which, onAddImage, onDelete, onReplace }: TProps) {
  const s = useSalon()

  return (
    <div className={s.imageArea}>
      <ImageTitle
        type={which}
        action={
          image && (
            <div className={s.uploadActions}>
              <button type='button' className={s.actionButton} onClick={() => onReplace(which)}>
                <UploadSVG className={s.actionIcon} />
                replace
              </button>
              <button type='button' className={s.deleteButton} onClick={() => onDelete(which)}>
                <TrashSVG className={s.deleteIcon} />
                delete
              </button>
            </div>
          )
        }
      />

      {image ? (
        <ImageFields image={image} />
      ) : (
        <div className={s.actionArea}>
          <button
            type='button'
            className={s.addImageButton}
            aria-label={`Add ${which} image`}
            onClick={() => onAddImage(which)}
          >
            <PlusSVG className={s.addImageIcon} />
            Add {which === COVER_IMAGE_WHICH.PRIMARY ? 'Primary' : 'secondary'} image
          </button>
        </div>
      )}
    </div>
  )
}
