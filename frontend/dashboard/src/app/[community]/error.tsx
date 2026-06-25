'use client'

import useTrans from '~/hooks/useTrans'

const ErrorCommunity = () => {
  const { t } = useTrans()

  return (
    <div>
      <h2>{t('dsb.page.community_error')}</h2>
    </div>
  )
}

export default ErrorCommunity
