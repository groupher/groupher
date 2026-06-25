'use client'

import useTrans from '~/hooks/useTrans'

const NotFound = () => {
  const { t } = useTrans()

  return (
    <div>
      <div>{t('dsb.page.community_not_found')}</div>
    </div>
  )
}

export default NotFound
