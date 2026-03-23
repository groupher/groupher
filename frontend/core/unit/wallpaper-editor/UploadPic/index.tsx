import { type FC, memo } from 'react'

import UploadBox from './UploadBox'

const UploadPic: FC = () => {
  return (
    <div className='w-full mt-4 column-center'>
      <UploadBox />
    </div>
  )
}

export default memo(UploadPic)
