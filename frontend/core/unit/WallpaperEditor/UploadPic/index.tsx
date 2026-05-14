import { type FC, memo } from 'react'

import UploadBox from './UploadBox'

const UploadPic: FC = () => {
  return (
    <div className='column-center mt-4 w-full'>
      <UploadBox />
    </div>
  )
}

export default memo(UploadPic)
