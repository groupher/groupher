'use client'

import useTrans from '~/hooks/useTrans'

const CommunityPostPage = () => {
  const { t } = useTrans()

  return <h2>{t('dsb.page.community_served')}</h2>
}

export default CommunityPostPage
