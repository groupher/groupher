import { type FC, memo } from 'react'

import UploadBox from './UploadBox'

const UploadTab: FC = () => {
  return (
    <div className='column-center mt-4 w-full'>
      <UploadBox />
    </div>
  )
}

export default memo(UploadTab)
