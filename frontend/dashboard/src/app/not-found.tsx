'use client'

import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

const NotFound = () => {
  return (
    <div className='flex flex-col items-center justify-center gap-4 py-16'>
      <LavaLampLoading />
      <p className='text-lg font-semibold text-neutral-400'>Page not found</p>
    </div>
  )
}

export default NotFound
