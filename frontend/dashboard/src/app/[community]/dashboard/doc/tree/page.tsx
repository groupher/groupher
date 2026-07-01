'use client'

import useTrans from '~/hooks/useTrans'

const DashboardDocPage = () => {
  const { t } = useTrans()

  return <h2>{t('dsb.page.doc.tree_todo')}</h2>
}

export default DashboardDocPage
