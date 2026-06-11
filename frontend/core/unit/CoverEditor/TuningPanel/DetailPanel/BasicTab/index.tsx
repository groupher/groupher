import { COVER_IMAGE_WHICH } from '../../../constant'
import type { TCoverImageWhich, TTuningSetting } from '../../../spec'
import ImageSection from './ImageSection'
import useSalon from './salon'

type TProps = {
  setting: TTuningSetting
  onAddImage: (which: TCoverImageWhich) => void
  onDelete: (which: TCoverImageWhich) => void
  onReplace: (which: TCoverImageWhich) => void
}

export default function BasicTab({ setting, onAddImage, onDelete, onReplace }: TProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <section className={s.imageSection}>
        <ImageSection
          image={setting.images.primary}
          which={COVER_IMAGE_WHICH.PRIMARY}
          onAddImage={onAddImage}
          onDelete={onDelete}
          onReplace={onReplace}
        />

        <div className={s.sectionDivider} />

        <ImageSection
          image={setting.images.secondary}
          which={COVER_IMAGE_WHICH.SECONDARY}
          onAddImage={onAddImage}
          onDelete={onDelete}
          onReplace={onReplace}
        />
      </section>
    </div>
  )
}
