'use client'

import useTrans from '~/hooks/useTrans'

const NotFound = () => {
  const { t } = useTrans()

  return (
    <div className='column-align-both gap-4 py-16'>
      <p className='text-lg font-semibold text-neutral-400'>{t('dsb.page.not_found')}</p>
    </div>
  )
}

export default NotFound
