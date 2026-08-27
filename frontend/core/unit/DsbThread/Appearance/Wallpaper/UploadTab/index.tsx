import { type FC, memo } from 'react'

import useSalon from './salon'
import UploadBox from './UploadBox'

const UploadTab: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <UploadBox />
    </div>
  )
}

export default memo(UploadTab)
