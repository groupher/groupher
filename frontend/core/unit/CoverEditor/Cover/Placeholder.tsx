import UploadSVG from '~/icons/Upload'

import useSalon from '../salon/cover/placeholder'

type TProps = {
  onUpload: () => void
}

export default function Placeholder({ onUpload }: TProps) {
  const s = useSalon()

  return (
    <button type='button' className={s.wrapper} aria-label='Upload cover image' onClick={onUpload}>
      <UploadSVG className={s.uploadIcon} />
    </button>
  )
}
